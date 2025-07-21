/**
 * Configuration des rôles et permissions
 * Définit les rôles utilisateurs et leurs permissions associées
 */

// =============================================
// DÉFINITION DES RÔLES
// =============================================

const ROLES = {
    ADMIN: 'admin',
    GESTIONNAIRE: 'gestionnaire',
    OPERATEUR: 'operateur',
    COMPTABLE: 'comptable',
    INVITE: 'invite'
};

// =============================================
// DÉFINITION DES PERMISSIONS
// =============================================

const PERMISSIONS = {
    // --- Clients ---
    CLIENT_VIEW: 'client.view',
    CLIENT_CREATE: 'client.create',
    CLIENT_UPDATE: 'client.update',
    CLIENT_DELETE: 'client.delete',
    CLIENT_EXPORT: 'client.export',
    CLIENT_IMPORT: 'client.import',
    
    // --- Marchandises ---
    MARCHANDISE_VIEW: 'marchandise.view',
    MARCHANDISE_CREATE: 'marchandise.create',
    MARCHANDISE_UPDATE: 'marchandise.update',
    MARCHANDISE_DELETE: 'marchandise.delete',
    MARCHANDISE_SCAN: 'marchandise.scan',
    MARCHANDISE_ASSIGN: 'marchandise.assign',
    
    // --- Conteneurs ---
    CONTENEUR_VIEW: 'conteneur.view',
    CONTENEUR_CREATE: 'conteneur.create',
    CONTENEUR_UPDATE: 'conteneur.update',
    CONTENEUR_DELETE: 'conteneur.delete',
    CONTENEUR_CLOSE: 'conteneur.close',
    CONTENEUR_REOPEN: 'conteneur.reopen',
    CONTENEUR_MANIFEST: 'conteneur.manifest',
    
    // --- Paiements ---
    PAIEMENT_VIEW: 'paiement.view',
    PAIEMENT_CREATE: 'paiement.create',
    PAIEMENT_UPDATE: 'paiement.update',
    PAIEMENT_DELETE: 'paiement.delete',
    PAIEMENT_VALIDATE: 'paiement.validate',
    PAIEMENT_EXPORT: 'paiement.export',
    
    // --- Rapports ---
    RAPPORT_VIEW: 'rapport.view',
    RAPPORT_CREATE: 'rapport.create',
    RAPPORT_EXPORT: 'rapport.export',
    RAPPORT_FINANCIAL: 'rapport.financial',
    RAPPORT_INVENTORY: 'rapport.inventory',
    RAPPORT_PERFORMANCE: 'rapport.performance',
    
    // --- Utilisateurs ---
    USER_VIEW: 'user.view',
    USER_CREATE: 'user.create',
    USER_UPDATE: 'user.update',
    USER_DELETE: 'user.delete',
    USER_ACTIVATE: 'user.activate',
    USER_DEACTIVATE: 'user.deactivate',
    
    // --- Paramètres ---
    SETTINGS_VIEW: 'settings.view',
    SETTINGS_UPDATE: 'settings.update',
    SETTINGS_BACKUP: 'settings.backup',
    SETTINGS_RESTORE: 'settings.restore',
    
    // --- Audit ---
    AUDIT_VIEW: 'audit.view',
    AUDIT_EXPORT: 'audit.export',
    
    // --- Notifications ---
    NOTIFICATION_SEND: 'notification.send',
    NOTIFICATION_BROADCAST: 'notification.broadcast'
};

// =============================================
// MAPPING RÔLES -> PERMISSIONS
// =============================================

const ROLE_PERMISSIONS = {
    // Administrateur - Toutes les permissions
    [ROLES.ADMIN]: '*',
    
    // Gestionnaire - Gestion complète sauf administration système
    [ROLES.GESTIONNAIRE]: [
        // Clients - Toutes permissions
        PERMISSIONS.CLIENT_VIEW,
        PERMISSIONS.CLIENT_CREATE,
        PERMISSIONS.CLIENT_UPDATE,
        PERMISSIONS.CLIENT_DELETE,
        PERMISSIONS.CLIENT_EXPORT,
        PERMISSIONS.CLIENT_IMPORT,
        
        // Marchandises - Toutes permissions
        PERMISSIONS.MARCHANDISE_VIEW,
        PERMISSIONS.MARCHANDISE_CREATE,
        PERMISSIONS.MARCHANDISE_UPDATE,
        PERMISSIONS.MARCHANDISE_DELETE,
        PERMISSIONS.MARCHANDISE_SCAN,
        PERMISSIONS.MARCHANDISE_ASSIGN,
        
        // Conteneurs - Toutes permissions
        PERMISSIONS.CONTENEUR_VIEW,
        PERMISSIONS.CONTENEUR_CREATE,
        PERMISSIONS.CONTENEUR_UPDATE,
        PERMISSIONS.CONTENEUR_DELETE,
        PERMISSIONS.CONTENEUR_CLOSE,
        PERMISSIONS.CONTENEUR_REOPEN,
        PERMISSIONS.CONTENEUR_MANIFEST,
        
        // Paiements - Toutes permissions
        PERMISSIONS.PAIEMENT_VIEW,
        PERMISSIONS.PAIEMENT_CREATE,
        PERMISSIONS.PAIEMENT_UPDATE,
        PERMISSIONS.PAIEMENT_DELETE,
        PERMISSIONS.PAIEMENT_VALIDATE,
        PERMISSIONS.PAIEMENT_EXPORT,
        
        // Rapports - Toutes permissions
        PERMISSIONS.RAPPORT_VIEW,
        PERMISSIONS.RAPPORT_CREATE,
        PERMISSIONS.RAPPORT_EXPORT,
        PERMISSIONS.RAPPORT_FINANCIAL,
        PERMISSIONS.RAPPORT_INVENTORY,
        PERMISSIONS.RAPPORT_PERFORMANCE,
        
        // Notifications
        PERMISSIONS.NOTIFICATION_SEND,
        
        // Audit en lecture
        PERMISSIONS.AUDIT_VIEW
    ],
    
    // Opérateur - Gestion quotidienne
    [ROLES.OPERATEUR]: [
        // Clients - Consultation et modification
        PERMISSIONS.CLIENT_VIEW,
        PERMISSIONS.CLIENT_CREATE,
        PERMISSIONS.CLIENT_UPDATE,
        
        // Marchandises - Gestion complète
        PERMISSIONS.MARCHANDISE_VIEW,
        PERMISSIONS.MARCHANDISE_CREATE,
        PERMISSIONS.MARCHANDISE_UPDATE,
        PERMISSIONS.MARCHANDISE_SCAN,
        PERMISSIONS.MARCHANDISE_ASSIGN,
        
        // Conteneurs - Consultation et mise à jour
        PERMISSIONS.CONTENEUR_VIEW,
        PERMISSIONS.CONTENEUR_UPDATE,
        PERMISSIONS.CONTENEUR_MANIFEST,
        
        // Paiements - Création seulement
        PERMISSIONS.PAIEMENT_VIEW,
        PERMISSIONS.PAIEMENT_CREATE,
        
        // Rapports - Consultation
        PERMISSIONS.RAPPORT_VIEW,
        PERMISSIONS.RAPPORT_INVENTORY
    ],
    
    // Comptable - Gestion financière
    [ROLES.COMPTABLE]: [
        // Clients - Consultation uniquement
        PERMISSIONS.CLIENT_VIEW,
        PERMISSIONS.CLIENT_EXPORT,
        
        // Marchandises - Consultation
        PERMISSIONS.MARCHANDISE_VIEW,
        
        // Conteneurs - Consultation
        PERMISSIONS.CONTENEUR_VIEW,
        PERMISSIONS.CONTENEUR_MANIFEST,
        
        // Paiements - Gestion complète
        PERMISSIONS.PAIEMENT_VIEW,
        PERMISSIONS.PAIEMENT_CREATE,
        PERMISSIONS.PAIEMENT_UPDATE,
        PERMISSIONS.PAIEMENT_DELETE,
        PERMISSIONS.PAIEMENT_VALIDATE,
        PERMISSIONS.PAIEMENT_EXPORT,
        
        // Rapports - Tous les rapports
        PERMISSIONS.RAPPORT_VIEW,
        PERMISSIONS.RAPPORT_CREATE,
        PERMISSIONS.RAPPORT_EXPORT,
        PERMISSIONS.RAPPORT_FINANCIAL,
        PERMISSIONS.RAPPORT_INVENTORY,
        PERMISSIONS.RAPPORT_PERFORMANCE,
        
        // Audit
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.AUDIT_EXPORT
    ],
    
    // Invité - Consultation uniquement
    [ROLES.INVITE]: [
        PERMISSIONS.CLIENT_VIEW,
        PERMISSIONS.MARCHANDISE_VIEW,
        PERMISSIONS.CONTENEUR_VIEW,
        PERMISSIONS.PAIEMENT_VIEW,
        PERMISSIONS.RAPPORT_VIEW
    ]
};

// =============================================
// HIÉRARCHIE DES RÔLES
// =============================================

const ROLE_HIERARCHY = {
    [ROLES.ADMIN]: 100,
    [ROLES.GESTIONNAIRE]: 80,
    [ROLES.OPERATEUR]: 60,
    [ROLES.COMPTABLE]: 60,
    [ROLES.INVITE]: 20
};

// =============================================
// MÉTADONNÉES DES RÔLES
// =============================================

const ROLE_METADATA = {
    [ROLES.ADMIN]: {
        name: 'Administrateur',
        description: 'Accès total au système',
        color: 'danger',
        icon: 'fas fa-crown',
        canManageUsers: true,
        canManageSettings: true,
        canViewAudit: true,
        canBackup: true
    },
    
    [ROLES.GESTIONNAIRE]: {
        name: 'Gestionnaire',
        description: 'Gestion complète des opérations',
        color: 'primary',
        icon: 'fas fa-user-tie',
        canManageUsers: false,
        canManageSettings: false,
        canViewAudit: true,
        canBackup: false
    },
    
    [ROLES.OPERATEUR]: {
        name: 'Opérateur',
        description: 'Gestion quotidienne des marchandises',
        color: 'success',
        icon: 'fas fa-user-cog',
        canManageUsers: false,
        canManageSettings: false,
        canViewAudit: false,
        canBackup: false
    },
    
    [ROLES.COMPTABLE]: {
        name: 'Comptable',
        description: 'Gestion financière et rapports',
        color: 'warning',
        icon: 'fas fa-calculator',
        canManageUsers: false,
        canManageSettings: false,
        canViewAudit: true,
        canBackup: false
    },
    
    [ROLES.INVITE]: {
        name: 'Invité',
        description: 'Consultation uniquement',
        color: 'secondary',
        icon: 'fas fa-eye',
        canManageUsers: false,
        canManageSettings: false,
        canViewAudit: false,
        canBackup: false
    }
};

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

/**
 * Vérifie si un rôle a une permission spécifique
 */
function hasPermission(role, permission) {
    if (!role || !permission) return false;
    
    const permissions = ROLE_PERMISSIONS[role];
    
    // Admin a toutes les permissions
    if (permissions === '*') return true;
    
    // Vérifier la liste des permissions
    if (Array.isArray(permissions)) {
        return permissions.includes(permission);
    }
    
    return false;
}

/**
 * Vérifie si un rôle a plusieurs permissions
 */
function hasAllPermissions(role, permissions) {
    return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Vérifie si un rôle a au moins une permission parmi plusieurs
 */
function hasAnyPermission(role, permissions) {
    return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Obtient toutes les permissions d'un rôle
 */
function getRolePermissions(role) {
    const permissions = ROLE_PERMISSIONS[role];
    
    if (permissions === '*') {
        return Object.values(PERMISSIONS);
    }
    
    return permissions || [];
}

/**
 * Vérifie si un rôle est supérieur à un autre
 */
function isRoleSuperior(role1, role2) {
    const level1 = ROLE_HIERARCHY[role1] || 0;
    const level2 = ROLE_HIERARCHY[role2] || 0;
    return level1 > level2;
}

/**
 * Vérifie si un rôle peut gérer un autre rôle
 */
function canManageRole(managerRole, targetRole) {
    // Seul admin peut gérer admin
    if (targetRole === ROLES.ADMIN) {
        return managerRole === ROLES.ADMIN;
    }
    
    // Vérifier la hiérarchie
    return isRoleSuperior(managerRole, targetRole);
}

/**
 * Obtient les rôles qu'un utilisateur peut attribuer
 */
function getAssignableRoles(userRole) {
    if (userRole === ROLES.ADMIN) {
        return Object.values(ROLES);
    }
    
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    
    return Object.entries(ROLE_HIERARCHY)
        .filter(([role, level]) => level < userLevel)
        .map(([role]) => role);
}

/**
 * Valide un rôle
 */
function isValidRole(role) {
    return Object.values(ROLES).includes(role);
}

/**
 * Obtient les métadonnées d'un rôle
 */
function getRoleMetadata(role) {
    return ROLE_METADATA[role] || null;
}

/**
 * Obtient la liste des permissions groupées par catégorie
 */
function getPermissionsByCategory() {
    const categories = {
        client: {
            name: 'Clients',
            permissions: []
        },
        marchandise: {
            name: 'Marchandises',
            permissions: []
        },
        conteneur: {
            name: 'Conteneurs',
            permissions: []
        },
        paiement: {
            name: 'Paiements',
            permissions: []
        },
        rapport: {
            name: 'Rapports',
            permissions: []
        },
        user: {
            name: 'Utilisateurs',
            permissions: []
        },
        settings: {
            name: 'Paramètres',
            permissions: []
        },
        audit: {
            name: 'Audit',
            permissions: []
        },
        notification: {
            name: 'Notifications',
            permissions: []
        }
    };
    
    Object.entries(PERMISSIONS).forEach(([key, permission]) => {
        const category = permission.split('.')[0];
        if (categories[category]) {
            categories[category].permissions.push({
                key,
                value: permission,
                label: key.replace(/_/g, ' ').toLowerCase()
            });
        }
    });
    
    return categories;
}

// =============================================
// EXPORT
// =============================================

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    ROLE_HIERARCHY,
    ROLE_METADATA,
    
    // Fonctions
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    getRolePermissions,
    isRoleSuperior,
    canManageRole,
    getAssignableRoles,
    isValidRole,
    getRoleMetadata,
    getPermissionsByCategory
};