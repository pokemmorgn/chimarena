// client/src/api.js - CLIENT ULTRA-SÉCURISÉ CRYPTO-GRADE + MODULE CRYPTO

const API_URL = (typeof window !== 'undefined' && window.GameConfig?.API_URL)
  ? window.GameConfig.API_URL
  : 'https://chimarena.cloud/api';

// 🔐 GESTIONNAIRE DE TOKENS EN MÉMOIRE UNIQUEMENT
class SecureTokenManager {
  constructor() {
    // TOKENS UNIQUEMENT EN MÉMOIRE - JAMAIS localStorage
    this.accessToken = null;
    this.refreshInProgress = false;
    this.refreshPromise = null;
    this.isAuthenticated = false;
    this.tokenExpiry = null;
    
    // Callbacks pour les événements
    this.onTokenRefreshed = null;
    this.onAuthenticationLost = null;
    
    // Nettoyage automatique à la fermeture
    this.setupCleanup();
  }

  setToken(token) {
    this.accessToken = token;
    this.isAuthenticated = !!token;
    
    // Décoder le token pour connaître l'expiration (sans validation côté client)
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.tokenExpiry = payload.exp * 1000; // Convertir en millisecondes
      } catch (e) {
        console.warn('⚠️ Impossible de décoder le token');
        this.tokenExpiry = Date.now() + (14 * 60 * 1000); // Assumer 14min
      }
    } else {
      this.tokenExpiry = null;
    }
  }

  getToken() {
    return this.accessToken;
  }

  clearToken() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.tokenExpiry = null;
    this.refreshInProgress = false;
    this.refreshPromise = null;
  }

  isTokenExpiringSoon() {
    if (!this.tokenExpiry) return false;
    // Rafraîchir 2 minutes avant expiration
    return (this.tokenExpiry - Date.now()) < (2 * 60 * 1000);
  }

  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    return Date.now() >= this.tokenExpiry;
  }

  setupCleanup() {
    // Nettoyage automatique à la fermeture de l'onglet/navigateur
    window.addEventListener('beforeunload', () => {
      this.clearToken();
    });

    // Nettoyage sur perte de focus prolongée (sécurité)
    let hiddenTime = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else {
        // Si l'onglet a été caché plus d'1 heure, forcer une reconnexion
        if (hiddenTime && (Date.now() - hiddenTime) > 60 * 60 * 1000) {
          this.clearToken();
          if (this.onAuthenticationLost) {
            this.onAuthenticationLost('Session expirée par inactivité');
          }
        }
      }
    });
  }
}

// Instance singleton du gestionnaire de tokens
const tokenManager = new SecureTokenManager();

// 🔄 GESTIONNAIRE DE REFRESH INTELLIGENT
class RefreshManager {
  async refreshToken() {
    // Éviter les refreshs simultanés
    if (tokenManager.refreshInProgress) {
      return tokenManager.refreshPromise;
    }

    tokenManager.refreshInProgress = true;
    tokenManager.refreshPromise = this.doRefresh();

    try {
      const result = await tokenManager.refreshPromise;
      return result;
    } finally {
      tokenManager.refreshInProgress = false;
      tokenManager.refreshPromise = null;
    }
  }

  async doRefresh() {
    try {
        console.log('🔄 Envoi requête refresh...');
        
        const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('📡 Réponse refresh:', response.status, response.statusText);

        if (!response.ok) {
            console.log('❌ Refresh échoué - Status:', response.status);
            throw new Error(`Refresh failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('📦 Data refresh:', data);
        
        if (data.success && data.token) {
            tokenManager.setToken(data.token);
            console.log('✅ Token refresh stocké en mémoire');
            
            if (tokenManager.onTokenRefreshed) {
                tokenManager.onTokenRefreshed(data.token);
            }
            
            return data.token;
        } else {
            throw new Error('Refresh response invalid');
        }
    } catch (error) {
        console.log('❌ Erreur complète refresh:', error);
        tokenManager.clearToken();
        
        if (tokenManager.onAuthenticationLost) {
            tokenManager.onAuthenticationLost('Session expirée');
        }
        
        throw error;
    }
  }

  // Refresh automatique si nécessaire
  async ensureValidToken() {
    if (!tokenManager.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    if (tokenManager.isTokenExpired()) {
      throw new Error('Token expired, refresh needed');
    }

    if (tokenManager.isTokenExpiringSoon()) {
      try {
        await this.refreshToken();
      } catch (error) {
        // Si le refresh échoue, on peut quand même essayer avec l'ancien token
        console.warn('⚠️ Refresh préventif échoué, tentative avec ancien token');
      }
    }
  }
}

const refreshManager = new RefreshManager();

// 🌐 CLIENT API PRINCIPAL
class SecureApiClient {
  constructor() {
    this.baseURL = API_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  // Préparer les headers avec auth
  getHeaders(customHeaders = {}) {
    const headers = { ...this.defaultHeaders, ...customHeaders };
    
    const token = tokenManager.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return headers;
  }

  // Requête HTTP de base avec gestion d'erreurs
  async request(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    const config = {
      credentials: 'include', // CRITIQUE pour les cookies
      ...options,
      headers: this.getHeaders(options.headers),
    };

    try {
      const response = await fetch(fullUrl, config);
      return await this.handleResponse(response, url, config);
    } catch (error) {
      console.error('🌐 Network error:', error);
      throw new Error('Erreur de connexion réseau');
    }
  }

  // Gestion intelligente des réponses
  async handleResponse(response, originalUrl, originalConfig) {
    let data = null;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }
    } catch (e) {
      // Réponse non-JSON, probablement une erreur serveur
    }

    if (response.ok) {
      return data;
    }

    // Gestion des erreurs d'authentification
    if (response.status === 401 || response.status === 403) {
      const errorMessage = data?.message || '';
      
      // Si c'est une erreur de token, essayer un refresh
      if (errorMessage.toLowerCase().includes('token') || 
          errorMessage.toLowerCase().includes('expiré') ||
          errorMessage.toLowerCase().includes('expired')) {
        
        try {
          await refreshManager.refreshToken();
          
          // Rejouer la requête avec le nouveau token
          const retryConfig = {
            ...originalConfig,
            headers: this.getHeaders(originalConfig.headers),
          };
          
          const retryResponse = await fetch(originalUrl.startsWith('http') ? originalUrl : `${this.baseURL}${originalUrl}`, retryConfig);
          return await this.handleResponse(retryResponse, originalUrl, retryConfig);
          
        } catch (refreshError) {
          // Le refresh a échoué, utilisateur doit se reconnecter
          throw new Error('Session expirée, veuillez vous reconnecter');
        }
      }
    }

    // Autres erreurs
    const errorMessage = data?.message || data?.error || `Erreur HTTP ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  // Requête GET
  async get(url, params = {}) {
    const urlObj = new URL(url.startsWith('http') ? url : `${this.baseURL}${url}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        urlObj.searchParams.append(key, params[key]);
      }
    });
    
    return this.request(urlObj.toString(), { method: 'GET' });
  }

  // Requête POST
  async post(url, data = {}) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Requête PUT
  async put(url, data = {}) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Requête DELETE
  async delete(url) {
    return this.request(url, { method: 'DELETE' });
  }

  // Requête authentifiée (assure un token valide)
  async authenticatedRequest(url, options = {}) {
    await refreshManager.ensureValidToken();
    return this.request(url, options);
  }
}

// Instance singleton du client API
const apiClient = new SecureApiClient();

// 🔐 API D'AUTHENTIFICATION
export const auth = {
  async register(userData) {
    const data = await apiClient.post('/auth/register', userData);
    
    if (data.success && data.token) {
      tokenManager.setToken(data.token);
    }
    
    return data;
  },

  async login(email, password) {
    const data = await apiClient.post('/auth/login', { email, password });
    
    if (data.success && data.token) {
      tokenManager.setToken(data.token);
    }
    
    return data;
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Toujours nettoyer les tokens locaux
      tokenManager.clearToken();
    }
  },

  async getMe() {
    return apiClient.authenticatedRequest('/auth/me');
  },

  async refreshToken() {
    return refreshManager.refreshToken();
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated() {
    return tokenManager.isAuthenticated && !tokenManager.isTokenExpired();
  },

  // Obtenir les infos du token (côté client seulement, pas de validation)
  getTokenInfo() {
    const token = tokenManager.getToken();
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        userId: payload.id,
        username: payload.username,
        email: payload.email,
        exp: payload.exp,
        iat: payload.iat,
      };
    } catch (e) {
      return null;
    }
  }
};

// 👤 API UTILISATEUR
export const user = {
  async getProfile() {
    return apiClient.authenticatedRequest('/user/profile');
  },

  async updateProfile(updates) {
    return apiClient.authenticatedRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async getStats() {
    return apiClient.authenticatedRequest('/user/stats');
  },

  async getDeck() {
    return apiClient.authenticatedRequest('/user/deck');
  },

  async getLeaderboard(limit = 50, offset = 0) {
    return apiClient.get('/user/leaderboard', { limit, offset });
  },

  async getPublicProfile(username) {
    return apiClient.get(`/user/${username}`);
  }
};

// 🎮 API GAMING (futures)
export const game = {
  // TODO: Implémenter quand les routes gaming seront créées
  async startMatch() {
    return apiClient.authenticatedRequest('/game/start');
  },

  async submitMatchResult(result) {
    return apiClient.authenticatedRequest('/game/match-result', {
      method: 'POST',
      body: JSON.stringify(result),
    });
  }
};

// 💰 API CRYPTO - NOUVELLEMENT IMPLÉMENTÉE
export const crypto = {
  // Connecter un wallet MetaMask (flow complet via challenge)
  async connectWallet() {
    // 1) Récupérer le challenge depuis le serveur
    const challenge = await apiClient.authenticatedRequest('/crypto/challenge');
    if (!challenge?.success || !challenge?.message) {
      throw new Error('Impossible de récupérer le challenge de signature');
    }
    const { message } = challenge;

    // 2) Récupérer l’adresse active de MetaMask
    if (!window.ethereum) throw new Error('MetaMask non détecté');
    const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error('Adresse Ethereum invalide');
    }

    // 3) Signer exactement le message renvoyé (ne pas le modifier)
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    });

    // 4) Envoyer au backend (le timestamp est déjà inclus dans le message)
    return apiClient.authenticatedRequest('/crypto/connect-wallet', {
      method: 'POST',
      body: JSON.stringify({ address, message, signature }),
    });
  },

  // Déconnecter le wallet
  async disconnectWallet() {
    return apiClient.authenticatedRequest('/crypto/disconnect-wallet', {
      method: 'POST',
    });
  },

  // Obtenir les informations du wallet connecté
  async getWalletInfo() {
    return apiClient.authenticatedRequest('/crypto/wallet-info');
  },

  // Vérifier une signature (utilitaire)
  async verifySignature(signatureData) {
    return apiClient.authenticatedRequest('/crypto/verify-signature', {
      method: 'POST',
      body: JSON.stringify(signatureData),
    });
  },

  // Obtenir le challenge pour signature (sécurité anti-replay)
  async getSignatureChallenge() {
    return apiClient.authenticatedRequest('/crypto/challenge');
  },

  // Actions crypto futures (très sécurisées)
  async getBalance() {
    return apiClient.authenticatedRequest('/crypto/balance');
  },

  async withdraw(amount, address, signature) {
    if (!amount || !address || !signature) {
      throw new Error('Paramètres de retrait manquants');
    }

    if (!window.GameUtils?.isValidEthereumAddress(address)) {
      throw new Error('Adresse de destination invalide');
    }

    if (amount <= 0) {
      throw new Error('Montant invalide');
    }

    return apiClient.authenticatedRequest('/crypto/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, address, signature }),
    });
  },

  async getTransactionHistory(limit = 20, offset = 0) {
    return apiClient.authenticatedRequest('/crypto/transactions', {
      method: 'GET',
      // Utiliser params pour GET
    });
  }
};

// 🔧 CONFIGURATION ET HOOKS
export const config = {
  // Configurer les callbacks d'événements
  onTokenRefreshed(callback) {
    tokenManager.onTokenRefreshed = callback;
  },

  onAuthenticationLost(callback) {
    tokenManager.onAuthenticationLost = callback;
  },

  // Debug info (development only)
  getDebugInfo() {
    if (process.env.NODE_ENV !== 'development') return null;
    
    return {
      hasToken: !!tokenManager.getToken(),
      isAuthenticated: tokenManager.isAuthenticated,
      tokenExpiry: tokenManager.tokenExpiry,
      timeToExpiry: tokenManager.tokenExpiry ? tokenManager.tokenExpiry - Date.now() : null,
      isExpiringSoon: tokenManager.isTokenExpiringSoon(),
      refreshInProgress: tokenManager.refreshInProgress,
    };
  }
};

// Export par défaut pour compatibilité
export default {
  auth,
  user,
  game,
  crypto, // NOUVEAU MODULE CRYPTO
  config,
  
  // Méthodes directes pour compatibilité avec l'ancien code
  login: auth.login,
  register: auth.register,
  logout: auth.logout,
  getMe: auth.getMe,
  isAuthenticated: auth.isAuthenticated,
  
  // Client API direct si nécessaire
  apiClient,
};

// 🧹 NETTOYAGE GLOBAL
window.addEventListener('unload', () => {
  tokenManager.clearToken();
});
