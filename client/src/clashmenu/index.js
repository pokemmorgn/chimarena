// client/src/clashmenu/index.js - EXPORTS PROPRES DES COMPOSANTS

// Import des composants
import ClashHeader from './ClashHeader.js';
import ArenaDisplay from './ArenaDisplay.js';
import TabNavigation from './TabNavigation.js';
import TabPanels from './TabPanels.js';
import ClashButton from './ClashButton.js';

// Export individuel pour flexibilité
export { ClashHeader };
export { ArenaDisplay };
export { TabNavigation };
export { TabPanels };
export { ClashButton };

// Export groupé par défaut
export default {
    ClashHeader,
    ArenaDisplay,
    TabNavigation,
    TabPanels,
    ClashButton
};

// Export nommé pour usage simple
export const ClashMenuComponents = {
    ClashHeader,
    ArenaDisplay,
    TabNavigation,
    TabPanels,
    ClashButton
};

console.log('📦 Composants ClashMenu exportés');
