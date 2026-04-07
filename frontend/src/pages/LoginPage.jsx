import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Swords, LogIn } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const { isDark } = useTheme();

  const backgroundImage = isDark
    ? 'https://static.prod-images.emergentagent.com/jobs/190a821f-5d98-47ed-9d31-3703487ac124/images/d51fdee289ffa2ffb66c360aca48fadc7d62be094d89262281449c40d4cc272d.png'
    : 'https://static.prod-images.emergentagent.com/jobs/190a821f-5d98-47ed-9d31-3703487ac124/images/887b20604205d87d1ae1f49088ac126bf35b191025867095586fbf4cf9479699.png';

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Form side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-3 mb-6">
              <Swords className="h-12 w-12 text-primary" />
              <h1 className="text-4xl font-black tracking-tighter uppercase">
                TCG Manager
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Gestion d'association de tournois TCG
            </p>
          </div>

          {/* Login form */}
          <div className="space-y-6 mt-12">
            <div className="swiss-card space-y-4">
              <h2 className="text-xl font-bold">Connexion</h2>
              <p className="text-sm text-muted-foreground">
                Connectez-vous avec votre compte Google pour accéder au panneau d'administration.
              </p>
              
              <Button
                onClick={login}
                className="w-full h-12 text-base font-bold gap-3"
                data-testid="google-login-btn"
              >
                <LogIn className="h-5 w-5" />
                Se connecter avec Google
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Accès réservé aux membres du bureau de l'association.
            </p>
          </div>
        </div>
      </div>

      {/* Image side */}
      <div
        className="hidden lg:block lg:w-1/2 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
        data-testid="login-background"
      />
    </div>
  );
}
