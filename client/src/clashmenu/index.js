// client/src/clashmenu/index.js - EXPORTS DU NOUVEAU SYSTÈME MODULAIRE

// === COMPOSANTS CORE (BASE) ===
import BasePanel from './core/BasePanel.js';
// ClashHeader et ClashButton sont encore dans l'ancien emplacement
import ClashHeader from './ClashHeader.js';
import ClashButton from './ClashButton.js';

// === GESTIONNAIRE CENTRAL ===
import PanelManager from './utils/PanelManager.js';

// === PANELS MODULAIRES ===
import BattlePanel from './battle/BattlePanel.js';
import DeckPanel from './deck/DeckPanel.js';
// import CollectionPanel from './collection/CollectionPanel.js'; // À créer
// import ClanPanel from './clan/ClanPanel.js'; // À créer  
// import ProfilePanel from './profile/ProfilePanel.js'; // À créer

// === EXPORTS PRINCIPAUX ===

// Export du gestionnaire central (point d'entrée principal)
export { PanelManager };

// Export des composants core
export { BasePanel };
export { ClashHeader };
export { ClashButton };

// Export des panels spécialisés
export { BattlePanel };
export { DeckPanel };

// === EXPORTS GROUPÉS ===

// Export principal pour utilisation simple
export default {
    // Gestionnaire
    PanelManager,
    
    // Core
    BasePanel,
    ClashHeader,
    ClashButton,
    
    // Panels
    BattlePanel,
    DeckPanel
};

// Export par catégorie pour organisation
export const CoreComponents = {
    BasePanel,
    ClashHeader,
    ClashButton
};

export const PanelComponents = {
    BattlePanel,
    DeckPanel
    // CollectionPanel, // À ajouter
    // ClanPanel, // À ajouter
    // ProfilePanel // À ajouter
};

export const ManagerComponents = {
    PanelManager
};

// Export legacy pour compatibilité (DÉPRÉCIÉ)
export const ClashMenuComponents = {
    // Nouveau système
    PanelManager,
    BasePanel,
    BattlePanel,
    DeckPanel,
    
    // Core toujours valides
    ClashHeader,
    ClashButton,
    
    // ANCIENS COMPOSANTS DÉPRÉCIÉS
    // ArenaDisplay, // Intégré dans BattlePanel
    // TabNavigation, // Intégré dans PanelManager
    // TabPanels // Remplacé par le système modulaire
};

console.log('📦 Nouveau système ClashMenu exporté');
console.log('✅ Système modulaire avec PanelManager');
console.log('🔧 4 onglets: Bataille, Cartes, Clan, Profil');
console.log('🃏 Panel Cartes avec sous-onglets: Collection, Deck, Défis');

// === INFORMATIONS DE MIGRATION ===
if (typeof window !== 'undefined') {
    // Ajouter des informations de debug
    window.ClashMenuInfo = {
        version: '2.0.0-modular',
        system: 'Modulaire avec PanelManager',
        panels: ['battle', 'cards', 'clan', 'profile'],
        subTabs: {
            cards: ['collection', 'deck', 'defis']
        },
        deprecated: [
            'ArenaDisplay (intégré dans BattlePanel)',
            'TabNavigation (intégré dans PanelManager)', 
            'TabPanels (remplacé par système modulaire)'
        ]
    };
    
    console.log('📋 Info système disponible: window.ClashMenuInfo');
}
