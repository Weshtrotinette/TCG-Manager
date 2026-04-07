from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="TCG Association Manager")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

# --- Auth Models ---
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    roles: List[str] = ["organisateur"]
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    roles: List[str]
    permissions: List[str] = []
    is_active: bool

# --- Role & Permission Models ---
class Permission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    permission_id: str = Field(default_factory=lambda: f"perm_{uuid.uuid4().hex[:12]}")
    module: str  # e.g., "members", "events", "sales"
    action: str  # e.g., "read", "create", "update", "delete"
    name_fr: str

class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role_id: str = Field(default_factory=lambda: f"role_{uuid.uuid4().hex[:12]}")
    name: str
    name_fr: str
    description: Optional[str] = None
    permissions: List[str] = []  # List of permission_ids
    is_system: bool = False  # System roles cannot be deleted
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoleCreate(BaseModel):
    name: str
    name_fr: str
    description: Optional[str] = None
    permissions: List[str] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    name_fr: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

# --- Member Models ---
class Member(BaseModel):
    model_config = ConfigDict(extra="ignore")
    member_id: str = Field(default_factory=lambda: f"member_{uuid.uuid4().hex[:12]}")
    first_name: str
    last_name: str
    pseudo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_participation_date: Optional[datetime] = None
    membership_date: Optional[datetime] = None
    status: str = "nouveau"  # nouveau, essai, actif, non_a_jour, archive
    notes: Optional[str] = None
    participation_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MemberCreate(BaseModel):
    first_name: str
    last_name: str
    pseudo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str = "nouveau"
    notes: Optional[str] = None

class MemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    pseudo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

# --- Subscription (Cotisation) Models ---
class Payment(BaseModel):
    payment_id: str = Field(default_factory=lambda: f"pay_{uuid.uuid4().hex[:12]}")
    amount: float
    payment_method: str  # especes, carte, virement, paypal, cheque, autre
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    recorded_by: Optional[str] = None
    comment: Optional[str] = None

class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    subscription_id: str = Field(default_factory=lambda: f"sub_{uuid.uuid4().hex[:12]}")
    member_id: str
    season: str  # e.g., "2024-2025"
    amount_due: float
    amount_paid: float = 0
    status: str = "non_payee"  # non_payee, partielle, payee
    payments: List[Payment] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubscriptionCreate(BaseModel):
    member_id: str
    season: str
    amount_due: float

class PaymentCreate(BaseModel):
    amount: float
    payment_method: str
    comment: Optional[str] = None

# --- Event Models ---
class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str = Field(default_factory=lambda: f"event_{uuid.uuid4().hex[:12]}")
    name: str
    date: datetime
    location: Optional[str] = None
    event_type: Optional[str] = None  # tournoi, casual, etc.
    format: Optional[str] = None
    max_capacity: int = 150
    entry_fee: float = 0
    notes: Optional[str] = None
    status: str = "a_venir"  # a_venir, en_cours, termine
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventCreate(BaseModel):
    name: str
    date: datetime
    location: Optional[str] = None
    event_type: Optional[str] = None
    format: Optional[str] = None
    max_capacity: int = 150
    entry_fee: float = 0
    notes: Optional[str] = None

class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[datetime] = None
    location: Optional[str] = None
    event_type: Optional[str] = None
    format: Optional[str] = None
    max_capacity: Optional[int] = None
    entry_fee: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None

# --- Participation Models ---
class Participation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    participation_id: str = Field(default_factory=lambda: f"part_{uuid.uuid4().hex[:12]}")
    event_id: str
    member_id: str
    is_present: bool = False
    entry_paid: bool = False
    payment_method: Optional[str] = None
    registered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ParticipationCreate(BaseModel):
    event_id: str
    member_id: str
    is_present: bool = False
    entry_paid: bool = False
    payment_method: Optional[str] = None

# --- Product Models ---
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str = Field(default_factory=lambda: f"prod_{uuid.uuid4().hex[:12]}")
    name: str
    category: str  # consommable, merchandising
    subcategory: Optional[str] = None  # boissons, nourriture, textile, etc.
    description: Optional[str] = None
    price: float
    cost: Optional[float] = None
    track_stock: bool = True
    stock_quantity: int = 0
    low_stock_threshold: Optional[int] = 5
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    price: float
    cost: Optional[float] = None
    track_stock: bool = True
    stock_quantity: int = 0
    low_stock_threshold: Optional[int] = 5

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    track_stock: Optional[bool] = None
    stock_quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    is_active: Optional[bool] = None

# --- Stock Movement Models ---
class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    movement_id: str = Field(default_factory=lambda: f"mov_{uuid.uuid4().hex[:12]}")
    product_id: str
    quantity: int  # positive for restock, negative for sales
    movement_type: str  # restock, sale, adjustment
    comment: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RestockCreate(BaseModel):
    quantity: int
    comment: Optional[str] = None

# --- Sale Models ---
class SaleItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    total_price: float

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sale_id: str = Field(default_factory=lambda: f"sale_{uuid.uuid4().hex[:12]}")
    items: List[SaleItem]
    total_amount: float
    payment_method: str  # especes, carte, autre
    payment_status: str = "paye"  # paye, en_attente, annule
    event_id: Optional[str] = None
    member_id: Optional[str] = None
    recorded_by: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaleCreate(BaseModel):
    items: List[Dict[str, Any]]  # [{product_id, quantity}]
    payment_method: str
    payment_status: str = "paye"
    event_id: Optional[str] = None
    member_id: Optional[str] = None
    comment: Optional[str] = None

# --- Expense Models ---
class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    expense_id: str = Field(default_factory=lambda: f"exp_{uuid.uuid4().hex[:12]}")
    amount: float
    category: str  # consommables, merchandising, location, lots, materiel, communication, divers
    subcategory: Optional[str] = None
    description: str
    payment_method: str
    expense_date: datetime
    event_id: Optional[str] = None
    supplier: Optional[str] = None
    reference: Optional[str] = None
    recorded_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseCreate(BaseModel):
    amount: float
    category: str
    subcategory: Optional[str] = None
    description: str
    payment_method: str
    expense_date: datetime
    event_id: Optional[str] = None
    supplier: Optional[str] = None
    reference: Optional[str] = None

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    expense_date: Optional[datetime] = None
    event_id: Optional[str] = None
    supplier: Optional[str] = None
    reference: Optional[str] = None

# --- Settings Models ---
class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    settings_id: str = "main_settings"
    annual_subscription_amount: float = 20.0
    max_free_participations: int = 3
    enable_trial_rule: bool = True
    enable_trial_alerts: bool = True
    current_season: str = "2024-2025"
    payment_methods: List[str] = ["especes", "carte", "virement", "paypal", "cheque", "autre"]
    member_statuses: List[str] = ["nouveau", "essai", "actif", "non_a_jour", "archive"]
    expense_categories: List[str] = ["consommables", "merchandising", "location", "lots", "materiel", "communication", "divers"]
    product_categories: List[str] = ["boissons", "nourriture", "formules", "accessoires", "textile", "goodies", "autres"]

class SettingsUpdate(BaseModel):
    annual_subscription_amount: Optional[float] = None
    max_free_participations: Optional[int] = None
    enable_trial_rule: Optional[bool] = None
    enable_trial_alerts: Optional[bool] = None
    current_season: Optional[str] = None
    payment_methods: Optional[List[str]] = None
    member_statuses: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    product_categories: Optional[List[str]] = None

# --- Audit Log Model ---
class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: f"log_{uuid.uuid4().hex[:12]}")
    user_id: str
    action: str
    module: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =============================================================================
# AUTHENTICATION HELPERS
# =============================================================================

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    # Find session
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Session invalide")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expirée")
    
    # Get user
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=401, detail="Compte désactivé")
    
    return User(**user_doc)

async def get_user_permissions(user: User) -> List[str]:
    """Get all permissions for a user based on their roles"""
    permissions = set()
    for role_name in user.roles:
        role_doc = await db.roles.find_one({"name": role_name}, {"_id": 0})
        if role_doc:
            permissions.update(role_doc.get("permissions", []))
    return list(permissions)

def check_permission(required_permission: str):
    """Decorator to check if user has required permission"""
    async def permission_checker(request: Request):
        user = await get_current_user(request)
        permissions = await get_user_permissions(user)
        
        # President has all permissions
        if "president" in user.roles:
            return user
        
        if required_permission not in permissions:
            raise HTTPException(status_code=403, detail="Permission refusée")
        return user
    return permission_checker

async def log_action(user_id: str, action: str, module: str, entity_id: str = None, details: str = None):
    """Log an audit action"""
    log = AuditLog(
        user_id=user_id,
        action=action,
        module=module,
        entity_id=entity_id,
        details=details
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.audit_logs.insert_one(doc)


# =============================================================================
# AUTH ROUTES
# =============================================================================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange Emergent session_id for app session"""
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id requis")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client_http:
        try:
            resp = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Session Emergent invalide")
            
            emergent_data = resp.json()
        except Exception as e:
            logger.error(f"Emergent auth error: {e}")
            raise HTTPException(status_code=500, detail="Erreur d'authentification")
    
    email = emergent_data.get("email")
    name = emergent_data.get("name")
    picture = emergent_data.get("picture")
    emergent_session_token = emergent_data.get("session_token")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
        user_doc = existing_user
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "roles": ["organisateur"],  # Default role
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        await log_action(user_id, "create", "users", user_id, f"Nouvel utilisateur créé: {email}")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Get permissions
    permissions = await get_user_permissions(User(**user_doc))
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "roles": user_doc.get("roles", ["organisateur"]),
        "permissions": permissions
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info"""
    permissions = await get_user_permissions(user)
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        roles=user.roles,
        permissions=permissions,
        is_active=user.is_active
    )

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Déconnexion réussie"}


# =============================================================================
# USER MANAGEMENT ROUTES
# =============================================================================

@api_router.get("/users")
async def list_users(user: User = Depends(get_current_user)):
    """List all users (admin only)"""
    if "president" not in user.roles:
        perms = await get_user_permissions(user)
        if "users:read" not in perms:
            raise HTTPException(status_code=403, detail="Permission refusée")
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}/roles")
async def update_user_roles(user_id: str, roles: List[str], user: User = Depends(get_current_user)):
    """Update user roles (admin only)"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"roles": roles}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    await log_action(user.user_id, "update", "users", user_id, f"Rôles modifiés: {roles}")
    return {"message": "Rôles mis à jour"}

@api_router.put("/users/{user_id}/status")
async def toggle_user_status(user_id: str, is_active: bool, user: User = Depends(get_current_user)):
    """Enable/disable user (admin only)"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_active": is_active}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    await log_action(user.user_id, "update", "users", user_id, f"Statut: {'actif' if is_active else 'désactivé'}")
    return {"message": "Statut mis à jour"}


# =============================================================================
# ROLES & PERMISSIONS ROUTES
# =============================================================================

@api_router.get("/roles")
async def list_roles(user: User = Depends(get_current_user)):
    """List all roles"""
    roles = await db.roles.find({}, {"_id": 0}).to_list(100)
    return roles

@api_router.post("/roles")
async def create_role(role_data: RoleCreate, user: User = Depends(get_current_user)):
    """Create a new role"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    role = Role(**role_data.model_dump())
    doc = role.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.roles.insert_one(doc)
    
    await log_action(user.user_id, "create", "roles", role.role_id, f"Rôle créé: {role.name}")
    return {"role_id": role.role_id, "message": "Rôle créé"}

@api_router.put("/roles/{role_id}")
async def update_role(role_id: str, role_data: RoleUpdate, user: User = Depends(get_current_user)):
    """Update a role"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    # Check if system role
    existing = await db.roles.find_one({"role_id": role_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rôle non trouvé")
    
    update_data = {k: v for k, v in role_data.model_dump().items() if v is not None}
    if update_data:
        await db.roles.update_one({"role_id": role_id}, {"$set": update_data})
    
    await log_action(user.user_id, "update", "roles", role_id, f"Rôle mis à jour")
    return {"message": "Rôle mis à jour"}

@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str, user: User = Depends(get_current_user)):
    """Delete a role (non-system only)"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    existing = await db.roles.find_one({"role_id": role_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rôle non trouvé")
    
    if existing.get("is_system"):
        raise HTTPException(status_code=400, detail="Impossible de supprimer un rôle système")
    
    await db.roles.delete_one({"role_id": role_id})
    await log_action(user.user_id, "delete", "roles", role_id, f"Rôle supprimé: {existing['name']}")
    return {"message": "Rôle supprimé"}

@api_router.get("/permissions")
async def list_permissions(user: User = Depends(get_current_user)):
    """List all available permissions"""
    permissions = await db.permissions.find({}, {"_id": 0}).to_list(200)
    return permissions


# =============================================================================
# MEMBER ROUTES
# =============================================================================

@api_router.get("/members")
async def list_members(
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List all members with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"pseudo": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    members = await db.members.find(query, {"_id": 0}).to_list(5000)
    
    # Get settings for trial rule
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    max_free = settings.get("max_free_participations", 3) if settings else 3
    
    # Add alerts
    for member in members:
        member["trial_alert"] = None
        if member["status"] in ["nouveau", "essai"]:
            count = member.get("participation_count", 0)
            if count >= max_free:
                member["trial_alert"] = "exceeded"
            elif count == max_free - 1:
                member["trial_alert"] = "warning"
    
    return members

@api_router.get("/members/{member_id}")
async def get_member(member_id: str, user: User = Depends(get_current_user)):
    """Get member details"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    # Get participations
    participations = await db.participations.find({"member_id": member_id}, {"_id": 0}).to_list(1000)
    
    # Get subscriptions
    subscriptions = await db.subscriptions.find({"member_id": member_id}, {"_id": 0}).to_list(100)
    
    return {
        **member,
        "participations": participations,
        "subscriptions": subscriptions
    }

@api_router.post("/members")
async def create_member(member_data: MemberCreate, user: User = Depends(get_current_user)):
    """Create a new member"""
    member = Member(**member_data.model_dump())
    doc = member.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('first_participation_date'):
        doc['first_participation_date'] = doc['first_participation_date'].isoformat()
    if doc.get('membership_date'):
        doc['membership_date'] = doc['membership_date'].isoformat()
    
    await db.members.insert_one(doc)
    await log_action(user.user_id, "create", "members", member.member_id, f"Membre créé: {member.first_name} {member.last_name}")
    
    return {"member_id": member.member_id, "message": "Membre créé"}

@api_router.put("/members/{member_id}")
async def update_member(member_id: str, member_data: MemberUpdate, user: User = Depends(get_current_user)):
    """Update a member"""
    existing = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    update_data = {k: v for k, v in member_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.members.update_one({"member_id": member_id}, {"$set": update_data})
    await log_action(user.user_id, "update", "members", member_id, "Membre mis à jour")
    
    return {"message": "Membre mis à jour"}

@api_router.delete("/members/{member_id}")
async def archive_member(member_id: str, user: User = Depends(get_current_user)):
    """Archive a member (soft delete)"""
    result = await db.members.update_one(
        {"member_id": member_id},
        {"$set": {"status": "archive", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    await log_action(user.user_id, "archive", "members", member_id, "Membre archivé")
    return {"message": "Membre archivé"}


# =============================================================================
# SUBSCRIPTION ROUTES
# =============================================================================

@api_router.get("/subscriptions")
async def list_subscriptions(
    season: Optional[str] = None,
    status: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List subscriptions"""
    query = {}
    if season:
        query["season"] = season
    if status:
        query["status"] = status
    
    subscriptions = await db.subscriptions.find(query, {"_id": 0}).to_list(5000)
    
    # Enrich with member info
    for sub in subscriptions:
        member = await db.members.find_one({"member_id": sub["member_id"]}, {"_id": 0, "first_name": 1, "last_name": 1})
        if member:
            sub["member_name"] = f"{member['first_name']} {member['last_name']}"
    
    return subscriptions

@api_router.post("/subscriptions")
async def create_subscription(sub_data: SubscriptionCreate, user: User = Depends(get_current_user)):
    """Create a subscription"""
    # Check member exists
    member = await db.members.find_one({"member_id": sub_data.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    # Check for existing subscription in same season
    existing = await db.subscriptions.find_one({
        "member_id": sub_data.member_id,
        "season": sub_data.season
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Cotisation déjà existante pour cette saison")
    
    subscription = Subscription(**sub_data.model_dump())
    doc = subscription.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.subscriptions.insert_one(doc)
    await log_action(user.user_id, "create", "subscriptions", subscription.subscription_id, 
                     f"Cotisation créée pour {member['first_name']} {member['last_name']}")
    
    return {"subscription_id": subscription.subscription_id, "message": "Cotisation créée"}

@api_router.post("/subscriptions/{subscription_id}/payments")
async def add_payment(subscription_id: str, payment_data: PaymentCreate, user: User = Depends(get_current_user)):
    """Add a payment to a subscription"""
    sub = await db.subscriptions.find_one({"subscription_id": subscription_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Cotisation non trouvée")
    
    payment = Payment(**payment_data.model_dump(), recorded_by=user.user_id)
    payment_doc = payment.model_dump()
    payment_doc['payment_date'] = payment_doc['payment_date'].isoformat()
    
    new_amount_paid = sub["amount_paid"] + payment.amount
    new_status = "payee" if new_amount_paid >= sub["amount_due"] else "partielle"
    
    await db.subscriptions.update_one(
        {"subscription_id": subscription_id},
        {
            "$push": {"payments": payment_doc},
            "$set": {"amount_paid": new_amount_paid, "status": new_status}
        }
    )
    
    # Update member status if fully paid
    if new_status == "payee":
        await db.members.update_one(
            {"member_id": sub["member_id"]},
            {"$set": {"status": "actif", "membership_date": datetime.now(timezone.utc).isoformat()}}
        )
    
    await log_action(user.user_id, "create", "payments", subscription_id, 
                     f"Paiement de {payment.amount}€ enregistré")
    
    return {"message": "Paiement enregistré", "new_status": new_status}


# =============================================================================
# EVENT ROUTES
# =============================================================================

@api_router.get("/events")
async def list_events(
    status: Optional[str] = None,
    upcoming: Optional[bool] = None,
    user: User = Depends(get_current_user)
):
    """List events"""
    query = {}
    if status:
        query["status"] = status
    if upcoming:
        query["date"] = {"$gte": datetime.now(timezone.utc).isoformat()}
    
    events = await db.events.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    
    # Add participant count
    for event in events:
        count = await db.participations.count_documents({"event_id": event["event_id"]})
        event["participant_count"] = count
    
    return events

@api_router.get("/events/{event_id}")
async def get_event(event_id: str, user: User = Depends(get_current_user)):
    """Get event details with participants and financials"""
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    # Get participations with member info
    participations = await db.participations.find({"event_id": event_id}, {"_id": 0}).to_list(200)
    for part in participations:
        member = await db.members.find_one({"member_id": part["member_id"]}, {"_id": 0, "first_name": 1, "last_name": 1, "pseudo": 1})
        if member:
            part["member_name"] = f"{member['first_name']} {member['last_name']}"
            part["member_pseudo"] = member.get("pseudo")
    
    # Get sales for this event
    sales = await db.sales.find({"event_id": event_id}, {"_id": 0}).to_list(1000)
    total_sales = sum(s.get("total_amount", 0) for s in sales if s.get("payment_status") == "paye")
    
    # Get entry fees collected
    entry_fees = sum(event.get("entry_fee", 0) for p in participations if p.get("entry_paid"))
    
    # Get expenses for this event
    expenses = await db.expenses.find({"event_id": event_id}, {"_id": 0}).to_list(500)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    
    return {
        **event,
        "participations": participations,
        "participant_count": len(participations),
        "present_count": sum(1 for p in participations if p.get("is_present")),
        "total_sales": total_sales,
        "total_entry_fees": entry_fees,
        "total_expenses": total_expenses,
        "net_result": total_sales + entry_fees - total_expenses
    }

@api_router.post("/events")
async def create_event(event_data: EventCreate, user: User = Depends(get_current_user)):
    """Create an event"""
    event = Event(**event_data.model_dump())
    doc = event.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.events.insert_one(doc)
    await log_action(user.user_id, "create", "events", event.event_id, f"Événement créé: {event.name}")
    
    return {"event_id": event.event_id, "message": "Événement créé"}

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, event_data: EventUpdate, user: User = Depends(get_current_user)):
    """Update an event"""
    existing = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    update_data = {k: v for k, v in event_data.model_dump().items() if v is not None}
    if "date" in update_data:
        update_data["date"] = update_data["date"].isoformat()
    
    await db.events.update_one({"event_id": event_id}, {"$set": update_data})
    await log_action(user.user_id, "update", "events", event_id, "Événement mis à jour")
    
    return {"message": "Événement mis à jour"}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: User = Depends(get_current_user)):
    """Delete an event"""
    result = await db.events.delete_one({"event_id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    await log_action(user.user_id, "delete", "events", event_id, "Événement supprimé")
    return {"message": "Événement supprimé"}


# =============================================================================
# PARTICIPATION ROUTES
# =============================================================================

@api_router.post("/participations")
async def add_participation(part_data: ParticipationCreate, user: User = Depends(get_current_user)):
    """Add a participant to an event"""
    # Check event exists
    event = await db.events.find_one({"event_id": part_data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    # Check member exists
    member = await db.members.find_one({"member_id": part_data.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    
    # Check not already registered
    existing = await db.participations.find_one({
        "event_id": part_data.event_id,
        "member_id": part_data.member_id
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Déjà inscrit à cet événement")
    
    participation = Participation(**part_data.model_dump())
    doc = participation.model_dump()
    doc['registered_at'] = doc['registered_at'].isoformat()
    
    await db.participations.insert_one(doc)
    
    # Increment member participation count and update first participation date if needed
    update_fields = {"$inc": {"participation_count": 1}}
    if not member.get("first_participation_date"):
        update_fields["$set"] = {"first_participation_date": datetime.now(timezone.utc).isoformat()}
    
    await db.members.update_one({"member_id": part_data.member_id}, update_fields)
    
    # Update member status based on participation count
    new_count = member.get("participation_count", 0) + 1
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    max_free = settings.get("max_free_participations", 3) if settings else 3
    
    if member["status"] == "nouveau" and new_count > 0:
        await db.members.update_one({"member_id": part_data.member_id}, {"$set": {"status": "essai"}})
    
    return {"participation_id": participation.participation_id, "message": "Participation enregistrée"}

@api_router.put("/participations/{participation_id}")
async def update_participation(participation_id: str, is_present: bool = None, entry_paid: bool = None, 
                                payment_method: str = None, user: User = Depends(get_current_user)):
    """Update participation status"""
    update_data = {}
    if is_present is not None:
        update_data["is_present"] = is_present
    if entry_paid is not None:
        update_data["entry_paid"] = entry_paid
    if payment_method is not None:
        update_data["payment_method"] = payment_method
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")
    
    result = await db.participations.update_one(
        {"participation_id": participation_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Participation non trouvée")
    
    return {"message": "Participation mise à jour"}

@api_router.delete("/participations/{participation_id}")
async def remove_participation(participation_id: str, user: User = Depends(get_current_user)):
    """Remove a participation"""
    part = await db.participations.find_one({"participation_id": participation_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Participation non trouvée")
    
    await db.participations.delete_one({"participation_id": participation_id})
    
    # Decrement member participation count
    await db.members.update_one(
        {"member_id": part["member_id"]},
        {"$inc": {"participation_count": -1}}
    )
    
    return {"message": "Participation supprimée"}


# =============================================================================
# PRODUCT ROUTES
# =============================================================================

@api_router.get("/products")
async def list_products(
    category: Optional[str] = None,
    active_only: bool = True,
    user: User = Depends(get_current_user)
):
    """List products"""
    query = {}
    if category:
        query["category"] = category
    if active_only:
        query["is_active"] = True
    
    products = await db.products.find(query, {"_id": 0}).to_list(500)
    return products

@api_router.get("/products/{product_id}")
async def get_product(product_id: str, user: User = Depends(get_current_user)):
    """Get product details"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    return product

@api_router.post("/products")
async def create_product(product_data: ProductCreate, user: User = Depends(get_current_user)):
    """Create a product"""
    product = Product(**product_data.model_dump())
    doc = product.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.products.insert_one(doc)
    await log_action(user.user_id, "create", "products", product.product_id, f"Produit créé: {product.name}")
    
    return {"product_id": product.product_id, "message": "Produit créé"}

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product_data: ProductUpdate, user: User = Depends(get_current_user)):
    """Update a product"""
    existing = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    
    update_data = {k: v for k, v in product_data.model_dump().items() if v is not None}
    
    await db.products.update_one({"product_id": product_id}, {"$set": update_data})
    await log_action(user.user_id, "update", "products", product_id, "Produit mis à jour")
    
    return {"message": "Produit mis à jour"}

@api_router.post("/products/{product_id}/restock")
async def restock_product(product_id: str, restock_data: RestockCreate, user: User = Depends(get_current_user)):
    """Restock a product"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    
    # Create movement record
    movement = StockMovement(
        product_id=product_id,
        quantity=restock_data.quantity,
        movement_type="restock",
        comment=restock_data.comment,
        recorded_by=user.user_id
    )
    mov_doc = movement.model_dump()
    mov_doc['created_at'] = mov_doc['created_at'].isoformat()
    await db.stock_movements.insert_one(mov_doc)
    
    # Update stock
    await db.products.update_one(
        {"product_id": product_id},
        {"$inc": {"stock_quantity": restock_data.quantity}}
    )
    
    await log_action(user.user_id, "restock", "products", product_id, f"Réapprovisionnement: +{restock_data.quantity}")
    
    return {"message": "Stock mis à jour"}


# =============================================================================
# SALES (POS) ROUTES
# =============================================================================

@api_router.get("/sales")
async def list_sales(
    event_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List sales"""
    query = {}
    if event_id:
        query["event_id"] = event_id
    if date_from or date_to:
        query["created_at"] = {}
        if date_from:
            query["created_at"]["$gte"] = date_from
        if date_to:
            query["created_at"]["$lte"] = date_to
    
    sales = await db.sales.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return sales

@api_router.post("/sales")
async def create_sale(sale_data: SaleCreate, user: User = Depends(get_current_user)):
    """Create a sale (quick checkout)"""
    items = []
    total_amount = 0
    
    for item in sale_data.items:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Produit {item['product_id']} non trouvé")
        
        quantity = item.get("quantity", 1)
        unit_price = product["price"]
        item_total = unit_price * quantity
        
        items.append(SaleItem(
            product_id=product["product_id"],
            product_name=product["name"],
            quantity=quantity,
            unit_price=unit_price,
            total_price=item_total
        ))
        
        total_amount += item_total
        
        # Decrement stock if tracked
        if product.get("track_stock"):
            await db.products.update_one(
                {"product_id": product["product_id"]},
                {"$inc": {"stock_quantity": -quantity}}
            )
            
            # Create stock movement
            movement = StockMovement(
                product_id=product["product_id"],
                quantity=-quantity,
                movement_type="sale",
                recorded_by=user.user_id
            )
            mov_doc = movement.model_dump()
            mov_doc['created_at'] = mov_doc['created_at'].isoformat()
            await db.stock_movements.insert_one(mov_doc)
    
    sale = Sale(
        items=[i.model_dump() for i in items],
        total_amount=total_amount,
        payment_method=sale_data.payment_method,
        payment_status=sale_data.payment_status,
        event_id=sale_data.event_id,
        member_id=sale_data.member_id,
        recorded_by=user.user_id,
        comment=sale_data.comment
    )
    
    doc = sale.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.sales.insert_one(doc)
    
    return {"sale_id": sale.sale_id, "total_amount": total_amount, "message": "Vente enregistrée"}

@api_router.put("/sales/{sale_id}/cancel")
async def cancel_sale(sale_id: str, user: User = Depends(get_current_user)):
    """Cancel a sale"""
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Vente non trouvée")
    
    if sale["payment_status"] == "annule":
        raise HTTPException(status_code=400, detail="Vente déjà annulée")
    
    # Restore stock
    for item in sale["items"]:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product and product.get("track_stock"):
            await db.products.update_one(
                {"product_id": item["product_id"]},
                {"$inc": {"stock_quantity": item["quantity"]}}
            )
    
    await db.sales.update_one({"sale_id": sale_id}, {"$set": {"payment_status": "annule"}})
    await log_action(user.user_id, "cancel", "sales", sale_id, "Vente annulée")
    
    return {"message": "Vente annulée"}


# =============================================================================
# EXPENSE ROUTES
# =============================================================================

@api_router.get("/expenses")
async def list_expenses(
    category: Optional[str] = None,
    event_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """List expenses"""
    query = {}
    if category:
        query["category"] = category
    if event_id:
        query["event_id"] = event_id
    if date_from or date_to:
        query["expense_date"] = {}
        if date_from:
            query["expense_date"]["$gte"] = date_from
        if date_to:
            query["expense_date"]["$lte"] = date_to
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("expense_date", -1).to_list(1000)
    return expenses

@api_router.post("/expenses")
async def create_expense(expense_data: ExpenseCreate, user: User = Depends(get_current_user)):
    """Create an expense"""
    expense = Expense(**expense_data.model_dump(), recorded_by=user.user_id)
    doc = expense.model_dump()
    doc['expense_date'] = doc['expense_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.expenses.insert_one(doc)
    await log_action(user.user_id, "create", "expenses", expense.expense_id, f"Dépense créée: {expense.description}")
    
    return {"expense_id": expense.expense_id, "message": "Dépense enregistrée"}

@api_router.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, expense_data: ExpenseUpdate, user: User = Depends(get_current_user)):
    """Update an expense"""
    existing = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Dépense non trouvée")
    
    update_data = {k: v for k, v in expense_data.model_dump().items() if v is not None}
    if "expense_date" in update_data:
        update_data["expense_date"] = update_data["expense_date"].isoformat()
    
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": update_data})
    await log_action(user.user_id, "update", "expenses", expense_id, "Dépense mise à jour")
    
    return {"message": "Dépense mise à jour"}

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: User = Depends(get_current_user)):
    """Delete an expense"""
    result = await db.expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dépense non trouvée")
    
    await log_action(user.user_id, "delete", "expenses", expense_id, "Dépense supprimée")
    return {"message": "Dépense supprimée"}


# =============================================================================
# DASHBOARD & REPORTS ROUTES
# =============================================================================

@api_router.get("/dashboard")
async def get_dashboard(user: User = Depends(get_current_user)):
    """Get dashboard statistics"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Member stats
    total_members = await db.members.count_documents({"status": {"$ne": "archive"}})
    active_members = await db.members.count_documents({"status": "actif"})
    trial_members = await db.members.count_documents({"status": {"$in": ["nouveau", "essai"]}})
    non_paid_members = await db.members.count_documents({"status": "non_a_jour"})
    
    # Get settings for trial alerts
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    max_free = settings.get("max_free_participations", 3) if settings else 3
    
    # Members needing attention (trial limit reached)
    trial_alert_count = await db.members.count_documents({
        "status": {"$in": ["nouveau", "essai"]},
        "participation_count": {"$gte": max_free}
    })
    
    # Subscription stats
    current_season = settings.get("current_season", "2024-2025") if settings else "2024-2025"
    paid_subs = await db.subscriptions.count_documents({"season": current_season, "status": "payee"})
    partial_subs = await db.subscriptions.count_documents({"season": current_season, "status": "partielle"})
    
    # Upcoming events
    upcoming_events = await db.events.find(
        {"date": {"$gte": now.isoformat()}, "status": "a_venir"},
        {"_id": 0}
    ).sort("date", 1).limit(5).to_list(5)
    
    # Monthly financials
    month_sales = await db.sales.find({
        "created_at": {"$gte": month_start.isoformat()},
        "payment_status": "paye"
    }, {"_id": 0}).to_list(10000)
    month_revenue = sum(s.get("total_amount", 0) for s in month_sales)
    
    month_expenses = await db.expenses.find({
        "expense_date": {"$gte": month_start.isoformat()}
    }, {"_id": 0}).to_list(10000)
    month_expense_total = sum(e.get("amount", 0) for e in month_expenses)
    
    # Monthly subscriptions revenue
    month_sub_payments = await db.subscriptions.aggregate([
        {"$unwind": "$payments"},
        {"$match": {"payments.payment_date": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$payments.amount"}}}
    ]).to_list(1)
    month_sub_revenue = month_sub_payments[0]["total"] if month_sub_payments else 0
    
    # Annual financials
    year_sales = await db.sales.find({
        "created_at": {"$gte": year_start.isoformat()},
        "payment_status": "paye"
    }, {"_id": 0}).to_list(50000)
    year_revenue = sum(s.get("total_amount", 0) for s in year_sales)
    
    year_expenses = await db.expenses.find({
        "expense_date": {"$gte": year_start.isoformat()}
    }, {"_id": 0}).to_list(50000)
    year_expense_total = sum(e.get("amount", 0) for e in year_expenses)
    
    year_sub_payments = await db.subscriptions.aggregate([
        {"$unwind": "$payments"},
        {"$match": {"payments.payment_date": {"$gte": year_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$payments.amount"}}}
    ]).to_list(1)
    year_sub_revenue = year_sub_payments[0]["total"] if year_sub_payments else 0
    
    # Low stock products
    low_stock = await db.products.find({
        "track_stock": True,
        "is_active": True,
        "$expr": {"$lte": ["$stock_quantity", "$low_stock_threshold"]}
    }, {"_id": 0, "product_id": 1, "name": 1, "stock_quantity": 1, "low_stock_threshold": 1}).to_list(20)
    
    # Recent sales
    recent_sales = await db.sales.find(
        {"payment_status": "paye"},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "members": {
            "total": total_members,
            "active": active_members,
            "trial": trial_members,
            "non_paid": non_paid_members,
            "trial_alert": trial_alert_count
        },
        "subscriptions": {
            "paid": paid_subs,
            "partial": partial_subs,
            "season": current_season
        },
        "financials": {
            "month": {
                "revenue": month_revenue + month_sub_revenue,
                "expenses": month_expense_total,
                "result": (month_revenue + month_sub_revenue) - month_expense_total
            },
            "year": {
                "revenue": year_revenue + year_sub_revenue,
                "expenses": year_expense_total,
                "result": (year_revenue + year_sub_revenue) - year_expense_total
            }
        },
        "upcoming_events": upcoming_events,
        "low_stock_alerts": low_stock,
        "recent_sales": recent_sales
    }

@api_router.get("/reports/financial")
async def get_financial_report(
    year: Optional[int] = None,
    user: User = Depends(get_current_user)
):
    """Get detailed financial report"""
    now = datetime.now(timezone.utc)
    target_year = year or now.year
    year_start = datetime(target_year, 1, 1, tzinfo=timezone.utc)
    year_end = datetime(target_year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    
    # Revenue by category
    sales = await db.sales.find({
        "created_at": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()},
        "payment_status": "paye"
    }, {"_id": 0}).to_list(50000)
    
    revenue_by_category = {"ventes_consommables": 0, "ventes_merchandising": 0}
    for sale in sales:
        for item in sale.get("items", []):
            product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0, "category": 1})
            if product:
                cat = product.get("category", "consommable")
                if cat == "merchandising":
                    revenue_by_category["ventes_merchandising"] += item.get("total_price", 0)
                else:
                    revenue_by_category["ventes_consommables"] += item.get("total_price", 0)
    
    # Subscription revenue
    sub_payments = await db.subscriptions.aggregate([
        {"$unwind": "$payments"},
        {"$match": {
            "payments.payment_date": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$payments.amount"}}}
    ]).to_list(1)
    revenue_by_category["cotisations"] = sub_payments[0]["total"] if sub_payments else 0
    
    # Entry fees (from participations)
    events = await db.events.find({
        "date": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    entry_fee_total = 0
    for event in events:
        paid_entries = await db.participations.count_documents({
            "event_id": event["event_id"],
            "entry_paid": True
        })
        entry_fee_total += paid_entries * event.get("entry_fee", 0)
    revenue_by_category["inscriptions_tournois"] = entry_fee_total
    
    # Expenses by category
    expenses = await db.expenses.find({
        "expense_date": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    expenses_by_category = {}
    for expense in expenses:
        cat = expense.get("category", "divers")
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + expense.get("amount", 0)
    
    # Monthly breakdown
    monthly_data = []
    for month in range(1, 13):
        month_start = datetime(target_year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(target_year, month + 1, 1, tzinfo=timezone.utc)
        
        month_sales = [s for s in sales if month_start.isoformat() <= s.get("created_at", "") < month_end.isoformat()]
        month_revenue = sum(s.get("total_amount", 0) for s in month_sales)
        
        month_expenses = [e for e in expenses if month_start.isoformat() <= e.get("expense_date", "") < month_end.isoformat()]
        month_expense_total = sum(e.get("amount", 0) for e in month_expenses)
        
        monthly_data.append({
            "month": month,
            "revenue": month_revenue,
            "expenses": month_expense_total,
            "result": month_revenue - month_expense_total
        })
    
    total_revenue = sum(revenue_by_category.values())
    total_expenses = sum(expenses_by_category.values())
    
    return {
        "year": target_year,
        "revenue": {
            "total": total_revenue,
            "by_category": revenue_by_category
        },
        "expenses": {
            "total": total_expenses,
            "by_category": expenses_by_category
        },
        "result": total_revenue - total_expenses,
        "monthly": monthly_data
    }

@api_router.get("/reports/members")
async def get_members_report(user: User = Depends(get_current_user)):
    """Get members report for export"""
    members = await db.members.find({}, {"_id": 0}).to_list(10000)
    
    # Enrich with subscription info
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    current_season = settings.get("current_season", "2024-2025") if settings else "2024-2025"
    
    for member in members:
        sub = await db.subscriptions.find_one({
            "member_id": member["member_id"],
            "season": current_season
        }, {"_id": 0})
        
        if sub:
            member["subscription_status"] = sub.get("status")
            member["subscription_amount_paid"] = sub.get("amount_paid", 0)
            member["subscription_amount_due"] = sub.get("amount_due", 0)
        else:
            member["subscription_status"] = "none"
            member["subscription_amount_paid"] = 0
            member["subscription_amount_due"] = 0
    
    return members


# =============================================================================
# SETTINGS ROUTES
# =============================================================================

@api_router.get("/settings")
async def get_settings(user: User = Depends(get_current_user)):
    """Get application settings"""
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    if not settings:
        # Return defaults
        default_settings = Settings()
        return default_settings.model_dump()
    return settings

@api_router.put("/settings")
async def update_settings(settings_data: SettingsUpdate, user: User = Depends(get_current_user)):
    """Update application settings"""
    if "president" not in user.roles:
        perms = await get_user_permissions(user)
        if "settings:update" not in perms:
            raise HTTPException(status_code=403, detail="Permission refusée")
    
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    
    await db.settings.update_one(
        {"settings_id": "main_settings"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_action(user.user_id, "update", "settings", "main_settings", "Paramètres mis à jour")
    return {"message": "Paramètres mis à jour"}


# =============================================================================
# AUDIT LOG ROUTES
# =============================================================================

@api_router.get("/audit-logs")
async def get_audit_logs(
    module: Optional[str] = None,
    limit: int = 100,
    user: User = Depends(get_current_user)
):
    """Get audit logs"""
    if "president" not in user.roles:
        perms = await get_user_permissions(user)
        if "audit:read" not in perms:
            raise HTTPException(status_code=403, detail="Permission refusée")
    
    query = {}
    if module:
        query["module"] = module
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return logs


# =============================================================================
# INITIALIZATION
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize database with default data"""
    # Initialize settings if not exists
    settings = await db.settings.find_one({"settings_id": "main_settings"})
    if not settings:
        default_settings = Settings()
        doc = default_settings.model_dump()
        await db.settings.insert_one(doc)
        logger.info("Default settings initialized")
    
    # Initialize default roles if not exists
    roles_count = await db.roles.count_documents({})
    if roles_count == 0:
        default_roles = [
            {
                "role_id": "role_president",
                "name": "president",
                "name_fr": "Président",
                "description": "Accès complet à toutes les fonctionnalités",
                "permissions": ["*"],  # All permissions
                "is_system": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "role_id": "role_tresorier",
                "name": "tresorier",
                "name_fr": "Trésorier",
                "description": "Gestion financière, cotisations, dépenses",
                "permissions": [
                    "dashboard:read", "members:read", "members:update",
                    "subscriptions:read", "subscriptions:create", "subscriptions:update",
                    "sales:read", "sales:create", "sales:cancel",
                    "expenses:read", "expenses:create", "expenses:update", "expenses:delete",
                    "products:read", "products:update",
                    "reports:read", "reports:export"
                ],
                "is_system": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "role_id": "role_organisateur",
                "name": "organisateur",
                "name_fr": "Organisateur",
                "description": "Gestion des événements et participations",
                "permissions": [
                    "dashboard:read", "members:read", "members:create", "members:update",
                    "events:read", "events:create", "events:update",
                    "participations:read", "participations:create", "participations:update", "participations:delete",
                    "products:read", "sales:read", "sales:create"
                ],
                "is_system": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "role_id": "role_lecture",
                "name": "lecture_seule",
                "name_fr": "Lecture seule",
                "description": "Consultation uniquement",
                "permissions": [
                    "dashboard:read", "members:read", "events:read",
                    "participations:read", "products:read", "sales:read",
                    "expenses:read", "reports:read"
                ],
                "is_system": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.roles.insert_many(default_roles)
        logger.info("Default roles initialized")
    
    # Initialize default permissions if not exists
    perms_count = await db.permissions.count_documents({})
    if perms_count == 0:
        modules = [
            ("dashboard", "Tableau de bord"),
            ("members", "Membres"),
            ("subscriptions", "Cotisations"),
            ("events", "Événements"),
            ("participations", "Participations"),
            ("products", "Produits"),
            ("sales", "Ventes"),
            ("expenses", "Dépenses"),
            ("reports", "Rapports"),
            ("settings", "Paramètres"),
            ("users", "Utilisateurs"),
            ("roles", "Rôles"),
            ("audit", "Audit")
        ]
        
        actions = [
            ("read", "Consulter"),
            ("create", "Créer"),
            ("update", "Modifier"),
            ("delete", "Supprimer"),
            ("export", "Exporter"),
            ("cancel", "Annuler")
        ]
        
        permissions = []
        for mod_key, mod_name in modules:
            for act_key, act_name in actions:
                # Skip irrelevant combinations
                if mod_key == "dashboard" and act_key != "read":
                    continue
                if mod_key == "reports" and act_key not in ["read", "export"]:
                    continue
                if mod_key == "audit" and act_key != "read":
                    continue
                if act_key == "cancel" and mod_key != "sales":
                    continue
                
                permissions.append({
                    "permission_id": f"perm_{mod_key}_{act_key}",
                    "module": mod_key,
                    "action": act_key,
                    "name_fr": f"{act_name} {mod_name}"
                })
        
        await db.permissions.insert_many(permissions)
        logger.info("Default permissions initialized")
    
    logger.info("Application startup complete")


# Include router and configure CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
