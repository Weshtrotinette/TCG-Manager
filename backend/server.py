from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import bcrypt
import jwt
import random
import math
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret_change_me')
JWT_ALGORITHM = "HS256"

# MongoDB connection
import certifi
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="TCG Association Manager")

# Uploads directory for product images
UPLOADS_DIR = ROOT_DIR / "uploads" / "products"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files as static
app.mount("/api/uploads", StaticFiles(directory=str(ROOT_DIR / "uploads")), name="uploads")

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
    member_type: str = "adherent"  # adherent, non_adherent
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
    member_type: str = "adherent"
    status: str = "nouveau"
    notes: Optional[str] = None

class MemberUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    pseudo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    member_type: Optional[str] = None
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
    includes_pack_tournois: bool = False
    includes_carte_snack: bool = False
    payments: List[Payment] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SubscriptionCreate(BaseModel):
    member_id: str
    season: str
    amount_due: float
    includes_pack_tournois: bool = False
    includes_carte_snack: bool = False

class PaymentCreate(BaseModel):
    amount: float
    payment_method: str
    comment: Optional[str] = None

# --- Snack Card Model ---
class SnackCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    card_id: str = Field(default_factory=lambda: f"snack_{uuid.uuid4().hex[:12]}")
    member_id: str
    balance: float
    initial_value: float
    season: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    image_url: Optional[str] = None
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
    image_url: Optional[str] = None
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
    image_url: Optional[str] = None
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
    season_renewal_day: int = 1
    season_renewal_month: int = 9
    pack_tournois_price: float = 5.0
    carte_snack_price: float = 10.0
    carte_snack_value: float = 12.0
    cards_are_permanent: bool = False
    payment_methods: List[str] = ["especes", "carte", "virement", "paypal", "cheque", "autre"]
    member_statuses: List[str] = ["nouveau", "essai", "actif", "non_a_jour", "archive"]
    expense_categories: List[str] = ["consommables", "merchandising", "location", "lots", "materiel", "communication", "divers"]
    product_categories: Dict[str, List[str]] = {"boissons": [], "nourriture": [], "formules": [], "accessoires": [], "textile": [], "goodies": [], "autres": []}
    pos_visible_subcategories: List[str] = []
    event_types: List[str] = ["tournoi", "ligue", "session_libre", "demonstration", "atelier"]
    event_formats: List[str] = ["suisse", "elimination_simple", "double_elimination", "round_robin", "poules_top_cut"]

class SettingsUpdate(BaseModel):
    annual_subscription_amount: Optional[float] = None
    max_free_participations: Optional[int] = None
    enable_trial_rule: Optional[bool] = None
    enable_trial_alerts: Optional[bool] = None
    current_season: Optional[str] = None
    season_renewal_day: Optional[int] = None
    season_renewal_month: Optional[int] = None
    pack_tournois_price: Optional[float] = None
    carte_snack_price: Optional[float] = None
    carte_snack_value: Optional[float] = None
    cards_are_permanent: Optional[bool] = None
    payment_methods: Optional[List[str]] = None
    member_statuses: Optional[List[str]] = None
    expense_categories: Optional[List[str]] = None
    product_categories: Optional[Dict[str, List[str]]] = None
    pos_visible_subcategories: Optional[List[str]] = None
    event_types: Optional[List[str]] = None
    event_formats: Optional[List[str]] = None

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

# --- Whitelist Model ---
class WhitelistEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: str
    added_by: Optional[str] = None
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    note: Optional[str] = None

class WhitelistCreate(BaseModel):
    email: str
    note: Optional[str] = None

# --- Tournament Models ---
class TournamentMatch(BaseModel):
    match_id: str = Field(default_factory=lambda: f"match_{uuid.uuid4().hex[:12]}")
    round_number: int
    table_number: Optional[int] = None
    player1_id: str
    player2_id: Optional[str] = None  # None = bye
    player1_name: str = ""
    player2_name: str = ""
    player1_score: Optional[int] = None
    player2_score: Optional[int] = None
    winner_id: Optional[str] = None
    is_draw: bool = False
    status: str = "en_attente"  # en_attente, en_cours, termine

class TournamentStanding(BaseModel):
    member_id: str
    member_name: str = ""
    points: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0
    games_played: int = 0
    opponents: List[str] = []
    buchholz: float = 0

class Tournament(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tournament_id: str = Field(default_factory=lambda: f"tourn_{uuid.uuid4().hex[:12]}")
    event_id: str
    format: str  # suisse, elimination_simple, double_elimination, round_robin, poules_top_cut
    total_rounds: int = 0
    current_round: int = 0
    status: str = "inscription"  # inscription, en_cours, termine
    participants: List[str] = []  # member_ids
    matches: List[Dict[str, Any]] = []
    standings: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TournamentCreate(BaseModel):
    event_id: str
    format: str
    participant_ids: List[str] = []

class MatchResultUpdate(BaseModel):
    player1_score: int
    player2_score: int

# --- Email/Password Auth Models ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# =============================================================================
# PASSWORD & JWT HELPERS
# =============================================================================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, 
        "email": email, 
        "exp": datetime.now(timezone.utc) + timedelta(days=7),  # 7 days for convenience
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id, 
        "exp": datetime.now(timezone.utc) + timedelta(days=30), 
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# =============================================================================
# AUTHENTICATION HELPERS
# =============================================================================

async def get_current_user(request: Request) -> User:
    """Get current user from session token or JWT (cookie or header)"""
    # Try session token first (Google OAuth)
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header for session token
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            # Check if it's a session token or JWT
            if token.startswith("session_") or token.startswith("test_session"):
                session_token = token
            else:
                # Try as JWT
                return await get_user_from_jwt(token)
    
    # Try JWT access_token cookie
    jwt_token = request.cookies.get("access_token")
    if jwt_token:
        return await get_user_from_jwt(jwt_token)
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    
    # Validate session token
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

async def get_user_from_jwt(token: str) -> User:
    """Get user from JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Type de token invalide")
        
        user_id = payload.get("sub")
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        if not user_doc.get("is_active", True):
            raise HTTPException(status_code=401, detail="Compte désactivé")
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

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
    
    # Check if email is whitelisted
    whitelist_entry = await db.whitelist.find_one({"email": email.lower()}, {"_id": 0})
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    # If not whitelisted and not an existing user, deny access
    if not whitelist_entry and not existing_user:
        raise HTTPException(
            status_code=403, 
            detail="Accès refusé. Votre email n'est pas autorisé. Contactez un administrateur."
        )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
        user_doc = existing_user
    else:
        # Create new user with lecture_seule role (lowest permissions)
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "roles": ["lecture_seule"],  # Default to read-only role
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
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Déconnexion réussie"}


# =============================================================================
# EMAIL/PASSWORD AUTH ROUTES
# =============================================================================

@api_router.post("/auth/register")
async def register(request_data: RegisterRequest, response: Response):
    """Register a new user with email/password"""
    email = request_data.email.lower().strip()
    
    # Check whitelist
    whitelist_entry = await db.whitelist.find_one({"email": email}, {"_id": 0})
    if not whitelist_entry:
        raise HTTPException(
            status_code=403, 
            detail="Accès refusé. Votre email n'est pas autorisé. Contactez un administrateur pour être ajouté à la liste."
        )
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")
    
    # Validate password
    if len(request_data.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères")
    
    # Create user with lecture_seule role (lowest permissions)
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(request_data.password)
    
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": request_data.name,
        "password_hash": password_hash,
        "picture": None,
        "roles": ["lecture_seule"],  # Default to read-only role
        "is_active": True,
        "auth_method": "email",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await log_action(user_id, "register", "users", user_id, f"Inscription par email: {email}")
    
    # Create tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 60 * 60, path="/"
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=True, samesite="none",
        max_age=30 * 24 * 60 * 60, path="/"
    )
    
    # Get permissions
    permissions = await get_user_permissions(User(**{k: v for k, v in user_doc.items() if k != 'password_hash'}))
    
    return {
        "user_id": user_id,
        "email": email,
        "name": request_data.name,
        "roles": ["lecture_seule"],
        "permissions": permissions,
        "message": "Inscription réussie"
    }

@api_router.post("/auth/login/email")
async def login_email(request_data: LoginRequest, request: Request, response: Response):
    """Login with email/password"""
    email = request_data.email.lower().strip()
    
    # Get client IP for brute force protection
    client_ip = request.client.host if request.client else "unknown"
    attempt_key = f"{client_ip}:{email}"
    
    # Check brute force lockout
    attempts_doc = await db.login_attempts.find_one({"identifier": attempt_key}, {"_id": 0})
    if attempts_doc:
        if attempts_doc.get("locked_until"):
            locked_until = datetime.fromisoformat(attempts_doc["locked_until"])
            if locked_until > datetime.now(timezone.utc):
                remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds() / 60)
                raise HTTPException(
                    status_code=429, 
                    detail=f"Trop de tentatives. Réessayez dans {remaining} minutes."
                )
    
    # Find user
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        await increment_login_attempts(attempt_key)
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Check if user has password (might be Google-only account)
    if not user_doc.get("password_hash"):
        raise HTTPException(
            status_code=400, 
            detail="Ce compte utilise la connexion Google. Utilisez 'Se connecter avec Google'."
        )
    
    # Verify password
    if not verify_password(request_data.password, user_doc["password_hash"]):
        await increment_login_attempts(attempt_key)
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Check if account is active
    if not user_doc.get("is_active", True):
        raise HTTPException(status_code=401, detail="Compte désactivé")
    
    # Clear failed attempts on success
    await db.login_attempts.delete_one({"identifier": attempt_key})
    
    user_id = user_doc["user_id"]
    
    # Create tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 60 * 60, path="/"
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=True, samesite="none",
        max_age=30 * 24 * 60 * 60, path="/"
    )
    
    await log_action(user_id, "login", "users", user_id, f"Connexion par email")
    
    # Get permissions
    permissions = await get_user_permissions(User(**{k: v for k, v in user_doc.items() if k != 'password_hash'}))
    
    return {
        "user_id": user_id,
        "email": email,
        "name": user_doc.get("name"),
        "picture": user_doc.get("picture"),
        "roles": user_doc.get("roles", ["lecture_seule"]),
        "permissions": permissions
    }

async def increment_login_attempts(attempt_key: str):
    """Increment failed login attempts and lock if necessary"""
    attempts_doc = await db.login_attempts.find_one({"identifier": attempt_key}, {"_id": 0})
    
    if attempts_doc:
        count = attempts_doc.get("count", 0) + 1
        update = {"$set": {"count": count, "last_attempt": datetime.now(timezone.utc).isoformat()}}
        
        if count >= 5:
            locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            update["$set"]["locked_until"] = locked_until.isoformat()
        
        await db.login_attempts.update_one({"identifier": attempt_key}, update)
    else:
        await db.login_attempts.insert_one({
            "identifier": attempt_key,
            "count": 1,
            "last_attempt": datetime.now(timezone.utc).isoformat()
        })

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    """Refresh access token"""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Token de rafraîchissement manquant")
    
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Type de token invalide")
        
        user_id = payload.get("sub")
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
        
        # Create new access token
        new_access_token = create_access_token(user_id, user_doc["email"])
        
        response.set_cookie(
            key="access_token", value=new_access_token,
            httponly=True, secure=True, samesite="none",
            max_age=7 * 24 * 60 * 60, path="/"
        )
        
        return {"message": "Token rafraîchi"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token de rafraîchissement expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


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

async def refresh_adherent_status(member_id: str):
    """Recalculate and update status for an adherent member based on participations and subscriptions.
    Non-adhérents are not affected."""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        return
    
    # Only auto-manage status for adhérents
    if member.get("member_type") != "adherent":
        return
    
    # Don't touch archived members
    if member.get("status") == "archive":
        return
    
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    max_free = settings.get("max_free_participations", 3) if settings else 3
    current_season = settings.get("current_season", "") if settings else ""
    
    count = member.get("participation_count", 0)
    
    # Check if subscription is paid for current season
    has_paid_sub = False
    if current_season:
        sub = await db.subscriptions.find_one({
            "member_id": member_id,
            "season": current_season,
            "status": "payee"
        }, {"_id": 0})
        has_paid_sub = sub is not None
    
    # Determine status
    if has_paid_sub:
        new_status = "actif"
    elif count == 0:
        new_status = "nouveau"
    elif count <= max_free:
        new_status = "essai"
    else:
        new_status = "non_a_jour"
    
    if member.get("status") != new_status:
        await db.members.update_one({"member_id": member_id}, {"$set": {"status": new_status}})

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
    
    # Add alerts (only for adhérents)
    for member in members:
        member["trial_alert"] = None
        if member.get("member_type", "adherent") == "adherent" and member["status"] in ["nouveau", "essai"]:
            count = member.get("participation_count", 0)
            if count >= max_free:
                member["trial_alert"] = "exceeded"
            elif count == max_free - 1:
                member["trial_alert"] = "warning"
    
    # Enrich with snack card balances
    all_cards = await db.snack_cards.find({"balance": {"$gt": 0}}, {"_id": 0, "member_id": 1, "balance": 1}).to_list(5000)
    snack_balances = {}
    for c in all_cards:
        snack_balances[c["member_id"]] = round(snack_balances.get(c["member_id"], 0) + c["balance"], 2)
    
    for member in members:
        mid = member["member_id"]
        member["snack_card_balance"] = snack_balances.get(mid, 0)
        member["has_pack_tournois"] = member.get("has_pack_tournois", False)
    
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

@api_router.put("/members/{member_id}/unarchive")
async def unarchive_member(member_id: str, user: User = Depends(get_current_user)):
    """Unarchive a member and recalculate status"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouvé")
    if member.get("status") != "archive":
        raise HTTPException(status_code=400, detail="Ce membre n'est pas archivé")
    
    # Set to nouveau temporarily, then let refresh_adherent_status calculate the right one
    await db.members.update_one(
        {"member_id": member_id},
        {"$set": {"status": "nouveau", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await refresh_adherent_status(member_id)
    
    await log_action(user.user_id, "unarchive", "members", member_id, "Membre désarchivé")
    return {"message": "Membre désarchivé"}


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
    
    # Batch fetch member info (avoid N+1)
    member_ids = list(set(s["member_id"] for s in subscriptions))
    if member_ids:
        members_list = await db.members.find({"member_id": {"$in": member_ids}}, {"_id": 0, "member_id": 1, "first_name": 1, "last_name": 1}).to_list(len(member_ids))
        members_map = {m["member_id"]: f"{m['first_name']} {m['last_name']}" for m in members_list}
    else:
        members_map = {}
    
    for sub in subscriptions:
        sub["member_name"] = members_map.get(sub["member_id"], sub["member_id"])
    
    return subscriptions

@api_router.post("/subscriptions")
async def create_subscription(sub_data: SubscriptionCreate, user: User = Depends(get_current_user)):
    """Create a subscription"""
    # Check member exists
    member = await db.members.find_one({"member_id": sub_data.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouve")
    
    # Check for existing subscription in same season
    existing = await db.subscriptions.find_one({
        "member_id": sub_data.member_id,
        "season": sub_data.season
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Cotisation deja existante pour cette saison")
    
    # Get settings for card values
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    
    subscription = Subscription(**sub_data.model_dump())
    doc = subscription.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.subscriptions.insert_one(doc)
    
    await log_action(user.user_id, "create", "subscriptions", subscription.subscription_id, 
                     f"Cotisation creee pour {member['first_name']} {member['last_name']}")
    
    return {"subscription_id": subscription.subscription_id, "message": "Cotisation creee"}

@api_router.put("/subscriptions/{subscription_id}")
async def update_subscription(subscription_id: str, user: User = Depends(get_current_user),
                               amount_due: Optional[float] = None, member_id: Optional[str] = None):
    """Update a subscription (amount_due, member_id)"""
    sub = await db.subscriptions.find_one({"subscription_id": subscription_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Cotisation non trouvée")
    
    update_data = {}
    if amount_due is not None:
        update_data["amount_due"] = amount_due
        # Recalculate status
        paid = sub.get("amount_paid", 0)
        if paid >= amount_due:
            update_data["status"] = "payee"
        elif paid > 0:
            update_data["status"] = "partielle"
        else:
            update_data["status"] = "non_payee"
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune modification")
    
    await db.subscriptions.update_one({"subscription_id": subscription_id}, {"$set": update_data})
    
    # Refresh member status
    await refresh_adherent_status(sub["member_id"])
    
    await log_action(user.user_id, "update", "subscriptions", subscription_id, "Cotisation modifiée")
    return {"message": "Cotisation modifiée"}

@api_router.delete("/subscriptions/{subscription_id}")
async def delete_subscription(subscription_id: str, user: User = Depends(get_current_user)):
    """Delete a subscription"""
    sub = await db.subscriptions.find_one({"subscription_id": subscription_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Cotisation non trouvée")
    
    await db.subscriptions.delete_one({"subscription_id": subscription_id})
    
    # Refresh member status
    await refresh_adherent_status(sub["member_id"])
    
    await log_action(user.user_id, "delete", "subscriptions", subscription_id, "Cotisation supprimée")
    return {"message": "Cotisation supprimée"}

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
            {"$set": {"membership_date": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Attribute pack tournois if included and not already given
        if sub.get("includes_pack_tournois"):
            await db.members.update_one(
                {"member_id": sub["member_id"]},
                {"$set": {"has_pack_tournois": True}}
            )
        
        # Attribute carte snack if included and not already given
        if sub.get("includes_carte_snack"):
            settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
            snack_value = settings.get("carte_snack_value", 12.0) if settings else 12.0
            # Check if card was already created for this subscription
            existing_card = await db.snack_cards.find_one({
                "member_id": sub["member_id"],
                "season": sub.get("season"),
                "initial_value": snack_value
            })
            if not existing_card:
                card = SnackCard(
                    member_id=sub["member_id"],
                    balance=snack_value,
                    initial_value=snack_value,
                    season=sub.get("season", "")
                )
                card_doc = card.model_dump()
                card_doc['created_at'] = card_doc['created_at'].isoformat()
                await db.snack_cards.insert_one(card_doc)
    
    # Auto-update adherent status
    await refresh_adherent_status(sub["member_id"])
    
    await log_action(user.user_id, "create", "payments", subscription_id, 
                     f"Paiement de {payment.amount}€ enregistré")
    
    return {"message": "Paiement enregistré", "new_status": new_status}

@api_router.post("/subscriptions/new-season")
async def start_new_season(user: User = Depends(get_current_user)):
    """Archive current subscriptions, start a new season, reset all adherent members"""
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=500, detail="Paramètres non trouvés")
    
    old_season = settings.get("current_season", "")
    new_season = str(datetime.now(timezone.utc).year)
    
    # Get current subscriptions to archive
    current_subs = await db.subscriptions.find({}, {"_id": 0}).to_list(10000)
    
    if current_subs:
        # Archive them
        archive_doc = {
            "archive_id": f"archive_{uuid.uuid4().hex[:12]}",
            "season": old_season,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_by": user.user_id,
            "subscriptions": current_subs,
            "total_due": sum(s.get("amount_due", 0) for s in current_subs),
            "total_paid": sum(s.get("amount_paid", 0) for s in current_subs),
            "count": len(current_subs),
        }
        await db.subscription_archives.insert_one(archive_doc)
        
        # Delete current subscriptions
        await db.subscriptions.delete_many({})
    
    # Update season in settings
    await db.settings.update_one(
        {"settings_id": "main_settings"},
        {"$set": {"current_season": new_season}}
    )
    
    # Reset all adherent members to non_a_jour (except archived)
    await db.members.update_many(
        {"member_type": "adherent", "status": {"$ne": "archive"}},
        {"$set": {"status": "non_a_jour"}}
    )
    
    # Handle seasonal cards: if cards_are_permanent is False, remove unused pack_tournois and snack cards
    if not settings.get("cards_are_permanent", False):
        # Remove all pack tournois
        await db.members.update_many(
            {"has_pack_tournois": True},
            {"$set": {"has_pack_tournois": False}}
        )
        # Remove snack cards with remaining balance (unused portion lost)
        await db.snack_cards.delete_many({"season": old_season})
        logger.info("Seasonal cards cleared (non-permanent)")
    
    await log_action(user.user_id, "create", "season", new_season, 
                     f"Nouvelle saison {new_season} - {len(current_subs)} cotisations archivees depuis {old_season}")
    
    return {
        "message": f"Saison {new_season} démarrée",
        "archived_count": len(current_subs),
        "old_season": old_season,
        "new_season": new_season,
    }

@api_router.post("/members/refresh-statuses")
async def refresh_all_adherent_statuses(user: User = Depends(get_current_user)):
    """Recalculate statuses for all adherent members"""
    members = await db.members.find({"member_type": "adherent", "status": {"$ne": "archive"}}, {"_id": 0, "member_id": 1}).to_list(10000)
    count = 0
    for m in members:
        await refresh_adherent_status(m["member_id"])
        count += 1
    return {"message": f"{count} statuts recalculés"}

@api_router.get("/subscriptions/archives")
async def list_subscription_archives(user: User = Depends(get_current_user)):
    """List all archived seasons"""
    archives = await db.subscription_archives.find({}, {"_id": 0, "subscriptions": 0}).sort("archived_at", -1).to_list(100)
    return archives

@api_router.get("/subscriptions/archives/{season}")
async def get_subscription_archive(season: str, user: User = Depends(get_current_user)):
    """Get archived subscriptions for a specific season"""
    archive = await db.subscription_archives.find_one({"season": season}, {"_id": 0})
    if not archive:
        raise HTTPException(status_code=404, detail="Archive non trouvée")
    return archive


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
    
    # Batch fetch participant counts (avoid N+1)
    event_ids = [e["event_id"] for e in events]
    if event_ids:
        counts = await db.participations.aggregate([
            {"$match": {"event_id": {"$in": event_ids}}},
            {"$group": {"_id": "$event_id", "count": {"$sum": 1}}}
        ]).to_list(len(event_ids))
        counts_map = {c["_id"]: c["count"] for c in counts}
    else:
        counts_map = {}
    
    for event in events:
        event["participant_count"] = counts_map.get(event["event_id"], 0)
    
    return events

@api_router.get("/events/{event_id}")
async def get_event(event_id: str, user: User = Depends(get_current_user)):
    """Get event details with participants and financials"""
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    # Get participations with member info (batch fetch)
    participations = await db.participations.find({"event_id": event_id}, {"_id": 0}).to_list(200)
    member_ids = list(set(p["member_id"] for p in participations))
    if member_ids:
        members_list = await db.members.find({"member_id": {"$in": member_ids}}, {"_id": 0, "member_id": 1, "first_name": 1, "last_name": 1, "pseudo": 1}).to_list(len(member_ids))
        members_map = {m["member_id"]: m for m in members_list}
    else:
        members_map = {}
    
    for part in participations:
        member = members_map.get(part["member_id"])
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
    
    # Auto-update adherent status
    await refresh_adherent_status(part_data.member_id)
    
    return {"participation_id": participation.participation_id, "message": "Participation enregistrée"}

@api_router.put("/participations/{participation_id}")
async def update_participation(participation_id: str, is_present: bool = None, entry_paid: bool = None, 
                                payment_method: str = None, use_pack_tournois: bool = None, user: User = Depends(get_current_user)):
    """Update participation status"""
    update_data = {}
    if is_present is not None:
        update_data["is_present"] = is_present
    if entry_paid is not None:
        update_data["entry_paid"] = entry_paid
    if payment_method is not None:
        update_data["payment_method"] = payment_method
    if use_pack_tournois is not None:
        update_data["used_pack_tournois"] = use_pack_tournois
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnee a mettre a jour")
    
    # If using pack tournois, consume it from the member
    if use_pack_tournois and entry_paid:
        part = await db.participations.find_one({"participation_id": participation_id}, {"_id": 0})
        if part:
            member = await db.members.find_one({"member_id": part["member_id"]}, {"_id": 0})
            if member and member.get("has_pack_tournois"):
                await db.members.update_one({"member_id": part["member_id"]}, {"$set": {"has_pack_tournois": False}})
                update_data["used_pack_tournois"] = True
    
    result = await db.participations.update_one(
        {"participation_id": participation_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Participation non trouvee")
    
    return {"message": "Participation mise a jour"}

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
    
    # Auto-update adherent status
    await refresh_adherent_status(part["member_id"])
    
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

@api_router.post("/products/{product_id}/upload-image")
async def upload_product_image(product_id: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload an image for a product"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Type de fichier non supporté. Utilisez JPG, PNG, WebP ou GIF.")
    
    # Limit file size to 5MB
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 5 Mo)")
    
    # Save file
    ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else 'jpg'
    filename = f"{product_id}.{ext}"
    filepath = UPLOADS_DIR / filename
    
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Update product with image URL
    image_url = f"/api/uploads/products/{filename}"
    await db.products.update_one({"product_id": product_id}, {"$set": {"image_url": image_url}})
    
    return {"image_url": image_url, "message": "Image uploadée"}

@api_router.delete("/products/{product_id}/image")
async def delete_product_image(product_id: str, user: User = Depends(get_current_user)):
    """Delete product image"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    
    # Remove file from disk
    if product.get("image_url"):
        filename = product["image_url"].split("/")[-1]
        filepath = UPLOADS_DIR / filename
        if filepath.exists():
            filepath.unlink()
    
    await db.products.update_one({"product_id": product_id}, {"$set": {"image_url": None}})
    return {"message": "Image supprimée"}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: User = Depends(get_current_user)):
    """Delete a product"""
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    
    # Remove image file if exists
    if product.get("image_url"):
        filename = product["image_url"].split("/")[-1]
        filepath = UPLOADS_DIR / filename
        if filepath.exists():
            filepath.unlink()
    
    await db.products.delete_one({"product_id": product_id})
    await log_action(user.user_id, "delete", "products", product_id, f"Produit supprimé: {product.get('name', '')}")
    return {"message": "Produit supprimé"}


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
    
    # Member stats (adherents only for status-based stats)
    total_members = await db.members.count_documents({"status": {"$ne": "archive"}})
    active_members = await db.members.count_documents({"member_type": "adherent", "status": "actif"})
    trial_members = await db.members.count_documents({"member_type": "adherent", "status": {"$in": ["nouveau", "essai"]}})
    non_paid_members = await db.members.count_documents({"member_type": "adherent", "status": "non_a_jour"})
    
    # Get settings for trial alerts
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    max_free = settings.get("max_free_participations", 3) if settings else 3
    
    # Members needing attention (trial limit reached - adherents only)
    trial_alert_count = await db.members.count_documents({
        "member_type": "adherent",
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
    
    # Monthly entry fees
    month_events = await db.events.find({
        "date": {"$gte": month_start.isoformat()}
    }, {"_id": 0}).to_list(100)
    month_entry_fees = 0
    for ev in month_events:
        if ev.get("entry_fee", 0) > 0:
            paid_entries = await db.participations.count_documents({
                "event_id": ev["event_id"],
                "entry_paid": True
            })
            month_entry_fees += paid_entries * ev.get("entry_fee", 0)
    
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
    
    # Annual entry fees
    year_events = await db.events.find({
        "date": {"$gte": year_start.isoformat()}
    }, {"_id": 0}).to_list(500)
    year_entry_fees = 0
    for ev in year_events:
        if ev.get("entry_fee", 0) > 0:
            paid_entries = await db.participations.count_documents({
                "event_id": ev["event_id"],
                "entry_paid": True
            })
            year_entry_fees += paid_entries * ev.get("entry_fee", 0)
    
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
                "revenue": month_revenue,
                "expenses": month_expense_total,
                "result": month_revenue - month_expense_total
            },
            "year": {
                "revenue": year_revenue + year_sub_revenue + year_entry_fees,
                "expenses": year_expense_total,
                "result": (year_revenue + year_sub_revenue + year_entry_fees) - year_expense_total
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
    
    # Subscription revenue with monthly breakdown
    sub_payment_docs = await db.subscriptions.aggregate([
        {"$unwind": "$payments"},
        {"$match": {
            "payments.payment_date": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()}
        }},
        {"$project": {
            "payment_date": "$payments.payment_date",
            "amount": "$payments.amount"
        }}
    ]).to_list(10000)
    
    sub_by_month = {}
    total_sub = 0
    for sp in sub_payment_docs:
        total_sub += sp.get("amount", 0)
        try:
            pd_str = sp.get("payment_date", "")
            pd = datetime.fromisoformat(pd_str.replace("Z", "+00:00"))
            if pd.year == target_year:
                sub_by_month[pd.month] = sub_by_month.get(pd.month, 0) + sp.get("amount", 0)
        except Exception:
            pass
    revenue_by_category["cotisations"] = total_sub
    
    # Entry fees (from participations) with monthly breakdown
    events = await db.events.find({
        "date": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    entry_fee_total = 0
    entry_fees_by_month = {}
    for event in events:
        paid_entries = await db.participations.count_documents({
            "event_id": event["event_id"],
            "entry_paid": True
        })
        fee = paid_entries * event.get("entry_fee", 0)
        entry_fee_total += fee
        event_date_str = event.get("date", "")
        if event_date_str:
            try:
                event_dt = datetime.fromisoformat(event_date_str.replace("Z", "+00:00"))
                if event_dt.year == target_year:
                    entry_fees_by_month[event_dt.month] = entry_fees_by_month.get(event_dt.month, 0) + fee
            except Exception:
                pass
    revenue_by_category["inscriptions_tournois"] = entry_fee_total
    
    # Expenses by category
    expenses = await db.expenses.find({
        "expense_date": {"$gte": year_start.isoformat(), "$lte": year_end.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    expenses_by_category = {}
    for expense in expenses:
        cat = expense.get("category", "divers")
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + expense.get("amount", 0)
    
    # Monthly breakdown (includes ALL revenue sources)
    monthly_data = []
    for month in range(1, 13):
        month_start = datetime(target_year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(target_year, month + 1, 1, tzinfo=timezone.utc)
        
        month_sales = [s for s in sales if month_start.isoformat() <= s.get("created_at", "") < month_end.isoformat()]
        month_sales_revenue = sum(s.get("total_amount", 0) for s in month_sales)
        
        # Add subscription and entry fee revenue for this month
        month_sub = sub_by_month.get(month, 0)
        month_entry = entry_fees_by_month.get(month, 0)
        month_revenue = month_sales_revenue + month_sub + month_entry
        
        month_expenses = [e for e in expenses if month_start.isoformat() <= e.get("expense_date", "") < month_end.isoformat()]
        month_expense_total = sum(e.get("amount", 0) for e in month_expenses)
        
        monthly_data.append({
            "month": month,
            "revenue": month_revenue,
            "sales": month_sales_revenue,
            "subscriptions": month_sub,
            "entry_fees": month_entry,
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
# SNACK CARD & PACK TOURNOIS ROUTES
# =============================================================================

@api_router.get("/snack-cards")
async def list_snack_cards(active_only: bool = True, user: User = Depends(get_current_user)):
    """List snack cards, optionally only active (balance > 0)"""
    query = {}
    if active_only:
        query["balance"] = {"$gt": 0}
    cards = await db.snack_cards.find(query, {"_id": 0}).to_list(5000)
    # Enrich with member names
    member_ids = list(set(c["member_id"] for c in cards))
    members_list = await db.members.find({"member_id": {"$in": member_ids}}, {"_id": 0, "member_id": 1, "first_name": 1, "last_name": 1, "pseudo": 1}).to_list(500)
    members_map = {m["member_id"]: f"{m['first_name']} {m['last_name']}" + (f" ({m['pseudo']})" if m.get('pseudo') else '') for m in members_list}
    for c in cards:
        c["member_name"] = members_map.get(c["member_id"], c["member_id"])
    return cards

@api_router.post("/snack-cards/{card_id}/deduct")
async def deduct_snack_card(card_id: str, amount: float, user: User = Depends(get_current_user)):
    """Deduct amount from a snack card"""
    card = await db.snack_cards.find_one({"card_id": card_id}, {"_id": 0})
    if not card:
        raise HTTPException(status_code=404, detail="Carte snack non trouvee")
    if card["balance"] <= 0:
        raise HTTPException(status_code=400, detail="Carte snack epuisee")
    
    deducted = min(amount, card["balance"])
    new_balance = round(card["balance"] - deducted, 2)
    await db.snack_cards.update_one({"card_id": card_id}, {"$set": {"balance": new_balance}})
    
    return {"deducted": deducted, "remaining": new_balance, "card_id": card_id}

@api_router.get("/members/{member_id}/pack-tournois")
async def get_member_pack_tournois(member_id: str, user: User = Depends(get_current_user)):
    """Check if member has a pack tournois"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0, "member_id": 1, "has_pack_tournois": 1})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouve")
    return {"has_pack_tournois": member.get("has_pack_tournois", False)}

@api_router.post("/members/{member_id}/use-pack-tournois")
async def use_pack_tournois(member_id: str, user: User = Depends(get_current_user)):
    """Consume a member's pack tournois"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouve")
    if not member.get("has_pack_tournois"):
        raise HTTPException(status_code=400, detail="Ce membre n'a pas de pack tournois")
    
    await db.members.update_one({"member_id": member_id}, {"$set": {"has_pack_tournois": False}})
    return {"message": "Pack tournois utilise"}

@api_router.delete("/members/{member_id}/pack-tournois")
async def remove_pack_tournois(member_id: str, user: User = Depends(get_current_user)):
    """Remove pack tournois from a member (admin correction)"""
    await db.members.update_one({"member_id": member_id}, {"$set": {"has_pack_tournois": False}})
    return {"message": "Pack tournois retire"}

@api_router.delete("/members/{member_id}/snack-cards")
async def remove_member_snack_cards(member_id: str, user: User = Depends(get_current_user)):
    """Remove all snack cards from a member (admin correction)"""
    result = await db.snack_cards.delete_many({"member_id": member_id})
    return {"message": f"{result.deleted_count} carte(s) snack supprimee(s)"}

@api_router.post("/snack-cards")
async def create_snack_card_direct(member_id: str, user: User = Depends(get_current_user)):
    """Create a snack card for a member (POS purchase)"""
    member = await db.members.find_one({"member_id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Membre non trouve")
    
    settings = await db.settings.find_one({"settings_id": "main_settings"}, {"_id": 0})
    snack_value = settings.get("carte_snack_value", 12.0) if settings else 12.0
    season = settings.get("current_season", "") if settings else ""
    
    card = SnackCard(
        member_id=member_id,
        balance=snack_value,
        initial_value=snack_value,
        season=season
    )
    card_doc = card.model_dump()
    card_doc['created_at'] = card_doc['created_at'].isoformat()
    await db.snack_cards.insert_one(card_doc)
    
    member_name = f"{member.get('first_name', '')} {member.get('last_name', '')}"
    await log_action(user.user_id, "create", "snack_cards", card.card_id, f"Carte snack creee pour {member_name} ({snack_value}EUR)")
    
    return {"card_id": card.card_id, "balance": snack_value, "message": f"Carte snack de {snack_value}EUR attribuee"}

@api_router.post("/admin/reset-financial-data")
async def reset_financial_data(user: User = Depends(get_current_user)):
    """Reset all financial data - sales, expenses, subscriptions, archives, cards"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Seul le president peut effectuer cette action")
    
    sales_count = await db.sales.count_documents({})
    expenses_count = await db.expenses.count_documents({})
    subs_count = await db.subscriptions.count_documents({})
    archives_count = await db.subscription_archives.count_documents({})
    cards_count = await db.snack_cards.count_documents({})
    movements_count = await db.stock_movements.count_documents({})
    
    await db.sales.delete_many({})
    await db.expenses.delete_many({})
    await db.subscriptions.delete_many({})
    await db.subscription_archives.delete_many({})
    await db.snack_cards.delete_many({})
    await db.stock_movements.delete_many({})
    await db.members.update_many({}, {"$set": {"has_pack_tournois": False}})
    
    await log_action(user.user_id, "delete", "admin", "reset_financial", 
        f"Reset financier: {sales_count} ventes, {expenses_count} depenses, {subs_count} cotisations, {archives_count} archives, {cards_count} cartes, {movements_count} mouvements")
    
    return {
        "message": "Donnees financieres reinitialisees",
        "deleted": {
            "sales": sales_count,
            "expenses": expenses_count,
            "subscriptions": subs_count,
            "archives": archives_count,
            "snack_cards": cards_count,
            "stock_movements": movements_count
        }
    }


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
# WHITELIST ROUTES
# =============================================================================

@api_router.get("/whitelist")
async def get_whitelist(user: User = Depends(get_current_user)):
    """Get all whitelisted emails"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    entries = await db.whitelist.find({}, {"_id": 0}).sort("added_at", -1).to_list(1000)
    return entries

@api_router.post("/whitelist")
async def add_to_whitelist(entry: WhitelistCreate, user: User = Depends(get_current_user)):
    """Add email to whitelist"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    email = entry.email.lower().strip()
    
    # Check if already exists
    existing = await db.whitelist.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà dans la liste")
    
    whitelist_entry = WhitelistEntry(
        email=email,
        added_by=user.user_id,
        note=entry.note
    )
    doc = whitelist_entry.model_dump()
    doc['added_at'] = doc['added_at'].isoformat()
    
    await db.whitelist.insert_one(doc)
    await log_action(user.user_id, "create", "whitelist", email, f"Email ajouté à la whitelist: {email}")
    
    return {"message": "Email ajouté à la liste", "email": email}

@api_router.post("/whitelist/bulk")
async def add_bulk_to_whitelist(emails: List[str], user: User = Depends(get_current_user)):
    """Add multiple emails to whitelist"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    added = []
    skipped = []
    
    for email in emails:
        email = email.lower().strip()
        if not email:
            continue
            
        existing = await db.whitelist.find_one({"email": email}, {"_id": 0})
        if existing:
            skipped.append(email)
            continue
        
        whitelist_entry = WhitelistEntry(
            email=email,
            added_by=user.user_id
        )
        doc = whitelist_entry.model_dump()
        doc['added_at'] = doc['added_at'].isoformat()
        await db.whitelist.insert_one(doc)
        added.append(email)
    
    if added:
        await log_action(user.user_id, "create", "whitelist", None, f"Ajout en masse: {len(added)} emails")
    
    return {"added": added, "skipped": skipped, "message": f"{len(added)} email(s) ajouté(s)"}

@api_router.delete("/whitelist/{email}")
async def remove_from_whitelist(email: str, user: User = Depends(get_current_user)):
    """Remove email from whitelist"""
    if "president" not in user.roles:
        raise HTTPException(status_code=403, detail="Permission refusée")
    
    email = email.lower().strip()
    result = await db.whitelist.delete_one({"email": email})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email non trouvé")
    
    await log_action(user.user_id, "delete", "whitelist", email, f"Email retiré de la whitelist: {email}")
    
    return {"message": "Email retiré de la liste"}


# =============================================================================
# TOURNAMENT ROUTES
# =============================================================================

def calculate_swiss_rounds(num_players: int) -> int:
    """Calculate number of rounds for Swiss format"""
    if num_players <= 1:
        return 0
    return math.ceil(math.log2(num_players))

def calculate_standings(matches: list, participants: list, members_map: dict) -> list:
    """Calculate tournament standings from matches"""
    standings = {}
    for pid in participants:
        standings[pid] = {
            "member_id": pid,
            "member_name": members_map.get(pid, pid),
            "points": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "games_played": 0,
            "opponents": [],
            "buchholz": 0
        }
    
    for m in matches:
        if m.get("status") != "termine":
            continue
        p1 = m.get("player1_id")
        p2 = m.get("player2_id")
        if not p1 or not p2:
            # Bye - player1 wins automatically
            if p1 and p1 in standings:
                standings[p1]["points"] += 3
                standings[p1]["wins"] += 1
                standings[p1]["games_played"] += 1
            continue
        
        if p1 in standings:
            standings[p1]["games_played"] += 1
            standings[p1]["opponents"].append(p2)
        if p2 in standings:
            standings[p2]["games_played"] += 1
            standings[p2]["opponents"].append(p1)
        
        if m.get("is_draw"):
            if p1 in standings:
                standings[p1]["points"] += 1
                standings[p1]["draws"] += 1
            if p2 in standings:
                standings[p2]["points"] += 1
                standings[p2]["draws"] += 1
        elif m.get("winner_id") == p1:
            if p1 in standings:
                standings[p1]["points"] += 3
                standings[p1]["wins"] += 1
            if p2 in standings:
                standings[p2]["losses"] += 1
        elif m.get("winner_id") == p2:
            if p2 in standings:
                standings[p2]["points"] += 3
                standings[p2]["wins"] += 1
            if p1 in standings:
                standings[p1]["losses"] += 1
    
    # Calculate Buchholz (sum of opponents' points)
    for pid, s in standings.items():
        s["buchholz"] = sum(standings.get(opp, {}).get("points", 0) for opp in s["opponents"])
    
    result = sorted(standings.values(), key=lambda x: (-x["points"], -x["buchholz"], -x["wins"]))
    for i, s in enumerate(result):
        s["rank"] = i + 1
    return result

def generate_swiss_pairings(standings: list, all_matches: list, round_number: int) -> list:
    """Generate Swiss pairings based on current standings"""
    # Get list of players sorted by points
    players = [s["member_id"] for s in standings]
    
    # Build set of past opponents for each player
    past_opponents = {p: set() for p in players}
    for m in all_matches:
        p1 = m.get("player1_id")
        p2 = m.get("player2_id")
        if p1 and p2:
            past_opponents.setdefault(p1, set()).add(p2)
            past_opponents.setdefault(p2, set()).add(p1)
    
    # Greedy pairing: go through sorted standings, pair adjacent players
    paired = set()
    pairings = []
    table = 1
    
    for i, player in enumerate(players):
        if player in paired:
            continue
        
        # Find best opponent (next unpaired player, preferably not yet faced)
        best_opponent = None
        for j in range(i + 1, len(players)):
            candidate = players[j]
            if candidate in paired:
                continue
            if candidate not in past_opponents.get(player, set()):
                best_opponent = candidate
                break
        
        # If no non-faced opponent, just take the next unpaired
        if best_opponent is None:
            for j in range(i + 1, len(players)):
                candidate = players[j]
                if candidate not in paired:
                    best_opponent = candidate
                    break
        
        if best_opponent:
            pairings.append({
                "match_id": f"match_{uuid.uuid4().hex[:12]}",
                "round_number": round_number,
                "table_number": table,
                "player1_id": player,
                "player2_id": best_opponent,
                "player1_score": None,
                "player2_score": None,
                "winner_id": None,
                "is_draw": False,
                "status": "en_attente"
            })
            paired.add(player)
            paired.add(best_opponent)
            table += 1
        else:
            # Bye
            pairings.append({
                "match_id": f"match_{uuid.uuid4().hex[:12]}",
                "round_number": round_number,
                "table_number": table,
                "player1_id": player,
                "player2_id": None,
                "player1_score": 2,
                "player2_score": 0,
                "winner_id": player,
                "is_draw": False,
                "status": "termine"
            })
            paired.add(player)
            table += 1
    
    return pairings

def generate_single_elimination_round(participants: list, round_number: int) -> list:
    """Generate single elimination matches with proper seeding.
    For the first round, pad to the nearest power of 2 with byes."""
    if round_number == 1:
        n = len(participants)
        # Find next power of 2
        bracket_size = 1
        while bracket_size < n:
            bracket_size *= 2
        
        # Pad with None (byes) at the end
        seeded = list(participants) + [None] * (bracket_size - n)
        
        # Standard bracket seeding: 1v(n), 2v(n-1), etc.
        # For simplicity, pair top half vs bottom half reversed
        half = bracket_size // 2
        top = seeded[:half]
        bottom = list(reversed(seeded[half:]))
        
        pairings = []
        table = 1
        for i in range(half):
            p1 = top[i]
            p2 = bottom[i]
            
            if p1 is None and p2 is None:
                continue
            elif p2 is None:
                # Player 1 gets a bye
                pairings.append({
                    "match_id": f"match_{uuid.uuid4().hex[:12]}",
                    "round_number": round_number,
                    "table_number": table,
                    "player1_id": p1,
                    "player2_id": None,
                    "player1_score": 2,
                    "player2_score": 0,
                    "winner_id": p1,
                    "is_draw": False,
                    "status": "termine"
                })
            elif p1 is None:
                pairings.append({
                    "match_id": f"match_{uuid.uuid4().hex[:12]}",
                    "round_number": round_number,
                    "table_number": table,
                    "player1_id": p2,
                    "player2_id": None,
                    "player1_score": 2,
                    "player2_score": 0,
                    "winner_id": p2,
                    "is_draw": False,
                    "status": "termine"
                })
            else:
                pairings.append({
                    "match_id": f"match_{uuid.uuid4().hex[:12]}",
                    "round_number": round_number,
                    "table_number": table,
                    "player1_id": p1,
                    "player2_id": p2,
                    "player1_score": None,
                    "player2_score": None,
                    "winner_id": None,
                    "is_draw": False,
                    "status": "en_attente"
                })
            table += 1
        return pairings
    else:
        # For subsequent rounds, just pair winners in order
        pairings = []
        table = 1
        for i in range(0, len(participants) - 1, 2):
            pairings.append({
                "match_id": f"match_{uuid.uuid4().hex[:12]}",
                "round_number": round_number,
                "table_number": table,
                "player1_id": participants[i],
                "player2_id": participants[i + 1],
                "player1_score": None,
                "player2_score": None,
                "winner_id": None,
                "is_draw": False,
                "status": "en_attente"
            })
            table += 1
        if len(participants) % 2 == 1:
            pairings.append({
                "match_id": f"match_{uuid.uuid4().hex[:12]}",
                "round_number": round_number,
                "table_number": table,
                "player1_id": participants[-1],
                "player2_id": None,
                "player1_score": 2,
                "player2_score": 0,
                "winner_id": participants[-1],
                "is_draw": False,
                "status": "termine"
            })
        return pairings

def generate_round_robin_matches(participants: list) -> list:
    """Generate round-robin matches distributed into proper rounds using the circle method.
    Each player plays exactly once per round."""
    n = len(participants)
    players = list(participants)
    
    # If odd number, add a dummy player for byes
    has_bye = False
    if n % 2 == 1:
        players.append(None)
        has_bye = True
        n += 1
    
    num_rounds = n - 1
    matches = []
    table_global = 1
    
    for round_num in range(num_rounds):
        round_number = round_num + 1
        table = 1
        
        for i in range(n // 2):
            p1 = players[i]
            p2 = players[n - 1 - i]
            
            if p1 is None or p2 is None:
                # Bye round - the real player gets a bye
                real_player = p1 if p1 is not None else p2
                if real_player:
                    matches.append({
                        "match_id": f"match_{uuid.uuid4().hex[:12]}",
                        "round_number": round_number,
                        "table_number": table,
                        "player1_id": real_player,
                        "player2_id": None,
                        "player1_score": 2,
                        "player2_score": 0,
                        "winner_id": real_player,
                        "is_draw": False,
                        "status": "termine"
                    })
                    table += 1
            else:
                matches.append({
                    "match_id": f"match_{uuid.uuid4().hex[:12]}",
                    "round_number": round_number,
                    "table_number": table,
                    "player1_id": p1,
                    "player2_id": p2,
                    "player1_score": None,
                    "player2_score": None,
                    "winner_id": None,
                    "is_draw": False,
                    "status": "en_attente"
                })
                table += 1
            table_global += 1
        
        # Rotate players (fix first player, rotate the rest)
        players = [players[0]] + [players[-1]] + players[1:-1]
    
    return matches

@api_router.get("/tournaments/event/{event_id}")
async def get_tournament_by_event(event_id: str, user: User = Depends(get_current_user)):
    """Get tournament for an event"""
    tournament = await db.tournaments.find_one({"event_id": event_id}, {"_id": 0})
    if not tournament:
        return None
    
    # Enrich with member names
    members_map = {}
    for pid in tournament.get("participants", []):
        member = await db.members.find_one({"member_id": pid}, {"_id": 0, "first_name": 1, "last_name": 1, "pseudo": 1})
        if member:
            name = f"{member['first_name']} {member['last_name']}"
            if member.get("pseudo"):
                name += f" ({member['pseudo']})"
            members_map[pid] = name
    
    # Enrich matches with names
    for m in tournament.get("matches", []):
        m["player1_name"] = members_map.get(m.get("player1_id"), "")
        if m.get("player2_id"):
            m["player2_name"] = members_map.get(m.get("player2_id"), "")
        else:
            m["player2_name"] = "BYE"
    
    # Enrich standings
    for s in tournament.get("standings", []):
        s["member_name"] = members_map.get(s.get("member_id"), "")
    
    tournament["members_map"] = members_map
    return tournament

@api_router.post("/tournaments")
async def create_tournament(data: TournamentCreate, user: User = Depends(get_current_user)):
    """Create a tournament for an event"""
    # Check event exists
    event = await db.events.find_one({"event_id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    # Check no existing tournament
    existing = await db.tournaments.find_one({"event_id": data.event_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Un tournoi existe déjà pour cet événement")
    
    # Get participant IDs - validate from event participations
    participant_ids = data.participant_ids
    
    # Get event participations to validate eligibility
    all_participations = await db.participations.find({"event_id": data.event_id}, {"_id": 0}).to_list(200)
    participation_map = {p["member_id"]: p for p in all_participations}
    is_free = not event.get("entry_fee") or event.get("entry_fee", 0) == 0
    
    if not participant_ids:
        # Auto-select eligible participants
        participant_ids = [
            p["member_id"] for p in all_participations
            if p.get("is_present") and (is_free or p.get("entry_paid"))
        ]
    else:
        # Validate provided participant IDs are eligible
        validated = []
        for pid in participant_ids:
            part = participation_map.get(pid)
            if part and part.get("is_present") and (is_free or part.get("entry_paid")):
                validated.append(pid)
        participant_ids = validated
    
    if len(participant_ids) < 2:
        raise HTTPException(status_code=400, detail="Il faut au moins 2 participants")
    
    # Build members map
    members_map = {}
    for pid in participant_ids:
        member = await db.members.find_one({"member_id": pid}, {"_id": 0, "first_name": 1, "last_name": 1, "pseudo": 1})
        if member:
            name = f"{member['first_name']} {member['last_name']}"
            if member.get("pseudo"):
                name += f" ({member['pseudo']})"
            members_map[pid] = name
    
    # Calculate rounds
    fmt = data.format
    if fmt == "suisse":
        total_rounds = calculate_swiss_rounds(len(participant_ids))
    elif fmt == "elimination_simple":
        total_rounds = math.ceil(math.log2(len(participant_ids)))
    elif fmt == "round_robin":
        n = len(participant_ids)
        total_rounds = n - 1 if n % 2 == 0 else n  # Circle method rounds
    else:
        total_rounds = calculate_swiss_rounds(len(participant_ids))
    
    # Generate initial matches
    random.shuffle(participant_ids)
    
    if fmt == "suisse":
        initial_standings = [{"member_id": pid, "member_name": members_map.get(pid, ""), "points": 0, "wins": 0, "losses": 0, "draws": 0, "games_played": 0, "opponents": [], "buchholz": 0, "rank": i+1} for i, pid in enumerate(participant_ids)]
        matches = generate_swiss_pairings(initial_standings, [], 1)
    elif fmt == "elimination_simple":
        matches = generate_single_elimination_round(participant_ids, 1)
    elif fmt == "round_robin":
        matches = generate_round_robin_matches(participant_ids)
    else:
        initial_standings = [{"member_id": pid, "member_name": members_map.get(pid, ""), "points": 0, "wins": 0, "losses": 0, "draws": 0, "games_played": 0, "opponents": [], "buchholz": 0, "rank": i+1} for i, pid in enumerate(participant_ids)]
        matches = generate_swiss_pairings(initial_standings, [], 1)
    
    # Add member names to matches
    for m in matches:
        m["player1_name"] = members_map.get(m["player1_id"], "")
        m["player2_name"] = members_map.get(m.get("player2_id"), "BYE") if m.get("player2_id") else "BYE"
    
    tournament = Tournament(
        event_id=data.event_id,
        format=fmt,
        total_rounds=total_rounds,
        current_round=1,
        status="en_cours",
        participants=participant_ids,
        matches=matches,
        standings=calculate_standings(matches, participant_ids, members_map)
    )
    
    doc = tournament.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.tournaments.insert_one(doc)
    
    await log_action(user.user_id, "create", "tournaments", tournament.tournament_id, f"Tournoi créé ({fmt}) pour {event['name']}")
    
    return {"tournament_id": tournament.tournament_id, "message": "Tournoi créé"}

@api_router.put("/tournaments/{tournament_id}/match/{match_id}")
async def update_match_result(tournament_id: str, match_id: str, result: MatchResultUpdate, user: User = Depends(get_current_user)):
    """Update match result"""
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    
    # Build members map
    members_map = {}
    for pid in tournament.get("participants", []):
        member = await db.members.find_one({"member_id": pid}, {"_id": 0, "first_name": 1, "last_name": 1, "pseudo": 1})
        if member:
            name = f"{member['first_name']} {member['last_name']}"
            if member.get("pseudo"):
                name += f" ({member['pseudo']})"
            members_map[pid] = name
    
    matches = tournament.get("matches", [])
    match_found = False
    
    for m in matches:
        if m["match_id"] == match_id:
            m["player1_score"] = result.player1_score
            m["player2_score"] = result.player2_score
            m["status"] = "termine"
            
            if result.player1_score > result.player2_score:
                m["winner_id"] = m["player1_id"]
                m["is_draw"] = False
            elif result.player2_score > result.player1_score:
                m["winner_id"] = m["player2_id"]
                m["is_draw"] = False
            else:
                m["winner_id"] = None
                m["is_draw"] = True
            
            match_found = True
            break
    
    if not match_found:
        raise HTTPException(status_code=404, detail="Match non trouvé")
    
    # Recalculate standings
    standings = calculate_standings(matches, tournament["participants"], members_map)
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$set": {"matches": matches, "standings": standings}}
    )
    
    return {"message": "Résultat enregistré"}

@api_router.post("/tournaments/{tournament_id}/next-round")
async def generate_next_round(tournament_id: str, user: User = Depends(get_current_user)):
    """Generate the next round of matches"""
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    
    current_round = tournament.get("current_round", 1)
    total_rounds = tournament.get("total_rounds", 1)
    fmt = tournament.get("format", "suisse")
    matches = tournament.get("matches", [])
    participants = tournament.get("participants", [])
    
    # Build members map
    members_map = {}
    for pid in participants:
        member = await db.members.find_one({"member_id": pid}, {"_id": 0, "first_name": 1, "last_name": 1, "pseudo": 1})
        if member:
            name = f"{member['first_name']} {member['last_name']}"
            if member.get("pseudo"):
                name += f" ({member['pseudo']})"
            members_map[pid] = name
    
    # Check all current round matches are complete
    current_round_matches = [m for m in matches if m.get("round_number") == current_round]
    incomplete = [m for m in current_round_matches if m.get("status") != "termine"]
    if incomplete:
        raise HTTPException(status_code=400, detail=f"Il reste {len(incomplete)} match(s) non terminé(s) dans la ronde actuelle")
    
    if current_round >= total_rounds:
        # Tournament is over
        standings = calculate_standings(matches, participants, members_map)
        await db.tournaments.update_one(
            {"tournament_id": tournament_id},
            {"$set": {"status": "termine", "standings": standings, "matches": matches}}
        )
        return {"message": "Tournoi terminé", "status": "termine"}
    
    next_round = current_round + 1
    
    if fmt == "suisse":
        standings = calculate_standings(matches, participants, members_map)
        new_matches = generate_swiss_pairings(standings, matches, next_round)
    elif fmt == "elimination_simple":
        # Winners advance
        winners = [m["winner_id"] for m in current_round_matches if m.get("winner_id")]
        if len(winners) < 2:
            standings = calculate_standings(matches, participants, members_map)
            await db.tournaments.update_one(
                {"tournament_id": tournament_id},
                {"$set": {"status": "termine", "standings": standings, "matches": matches}}
            )
            return {"message": "Tournoi terminé", "status": "termine"}
        new_matches = generate_single_elimination_round(winners, next_round)
    elif fmt == "round_robin":
        # Round-robin matches are all pre-generated, just advance the pointer
        next_round_matches = [m for m in matches if m.get("round_number") == next_round]
        if not next_round_matches:
            standings = calculate_standings(matches, participants, members_map)
            await db.tournaments.update_one(
                {"tournament_id": tournament_id},
                {"$set": {"status": "termine", "standings": standings, "current_round": current_round}}
            )
            return {"message": "Tournoi terminé", "status": "termine"}
        # Just advance current_round, matches are already there
        standings = calculate_standings(matches, participants, members_map)
        await db.tournaments.update_one(
            {"tournament_id": tournament_id},
            {"$set": {"current_round": next_round, "standings": standings}}
        )
        return {"message": f"Ronde {next_round} activée", "current_round": next_round}
    else:
        standings = calculate_standings(matches, participants, members_map)
        new_matches = generate_swiss_pairings(standings, matches, next_round)
    
    # Add member names
    for m in new_matches:
        m["player1_name"] = members_map.get(m["player1_id"], "")
        m["player2_name"] = members_map.get(m.get("player2_id"), "BYE") if m.get("player2_id") else "BYE"
    
    all_matches = matches + new_matches
    standings = calculate_standings(all_matches, participants, members_map)
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$set": {"current_round": next_round, "matches": all_matches, "standings": standings}}
    )
    
    return {"message": f"Ronde {next_round} générée", "current_round": next_round}

@api_router.delete("/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str, user: User = Depends(get_current_user)):
    """Delete a tournament"""
    result = await db.tournaments.delete_one({"tournament_id": tournament_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tournoi non trouvé")
    
    await log_action(user.user_id, "delete", "tournaments", tournament_id, "Tournoi supprimé")
    return {"message": "Tournoi supprimé"}


# =============================================================================
# INITIALIZATION
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize database with default data"""
    try:
        # Initialize settings if not exists
        settings = await db.settings.find_one({"settings_id": "main_settings"})
        if not settings:
            default_settings = Settings()
            doc = default_settings.model_dump()
            await db.settings.insert_one(doc)
            logger.info("Default settings initialized")
        else:
            # Migrate: add new fields if missing
            update_fields = {}
            if "event_types" not in settings:
                update_fields["event_types"] = ["tournoi", "ligue", "session_libre", "demonstration", "atelier"]
            if "event_formats" not in settings:
                update_fields["event_formats"] = ["suisse", "elimination_simple", "double_elimination", "round_robin", "poules_top_cut"]
            if "pos_visible_subcategories" not in settings:
                update_fields["pos_visible_subcategories"] = []
            if "pack_tournois_price" not in settings:
                update_fields["pack_tournois_price"] = 5.0
            if "carte_snack_price" not in settings:
                update_fields["carte_snack_price"] = 10.0
            if "carte_snack_value" not in settings:
                update_fields["carte_snack_value"] = 12.0
            if "cards_are_permanent" not in settings:
                update_fields["cards_are_permanent"] = False
            if "season_renewal_day" not in settings:
                update_fields["season_renewal_day"] = 1
            if "season_renewal_month" not in settings:
                update_fields["season_renewal_month"] = 9
            if update_fields:
                await db.settings.update_one({"settings_id": "main_settings"}, {"$set": update_fields})
                logger.info("Settings migrated with new fields")
            
            # Migrate product_categories from array to dict if needed
            if isinstance(settings.get("product_categories"), list):
                cats_dict = {}
                for cat in settings["product_categories"]:
                    cats_dict[cat] = []
                await db.settings.update_one({"settings_id": "main_settings"}, {"$set": {"product_categories": cats_dict}})
                logger.info("Product categories migrated to dict format")
        
        # Initialize default roles if not exists
        roles_count = await db.roles.count_documents({})
        if roles_count == 0:
            default_roles = [
                {
                    "role_id": "role_president",
                    "name": "president",
                    "name_fr": "Président",
                    "description": "Accès complet à toutes les fonctionnalités",
                    "permissions": ["*"],
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
                ("dashboard", "Tableau de bord"), ("members", "Membres"),
                ("subscriptions", "Cotisations"), ("events", "Événements"),
                ("participations", "Participations"), ("products", "Produits"),
                ("sales", "Ventes"), ("expenses", "Dépenses"),
                ("reports", "Rapports"), ("settings", "Paramètres"),
                ("users", "Utilisateurs"), ("roles", "Rôles"), ("audit", "Audit")
            ]
            actions = [
                ("read", "Consulter"), ("create", "Créer"), ("update", "Modifier"),
                ("delete", "Supprimer"), ("export", "Exporter"), ("cancel", "Annuler")
            ]
            permissions = []
            for mod_key, mod_name in modules:
                for act_key, act_name in actions:
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
    except Exception as e:
        logger.error(f"Startup initialization error (non-fatal): {e}")
    
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
