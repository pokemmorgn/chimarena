// server/src/utils/auditLogger.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { securityManager } from '../config/security';

export type AuditEventType = 
  | 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAILED' | 'AUTH_REGISTER' | 'AUTH_LOGOUT'
  | 'AUTH_TOKEN_REFRESH' | 'AUTH_PASSWORD_CHANGE' | 'AUTH_EMAIL_CHANGE'
  | 'CRYPTO_DEPOSIT' | 'CRYPTO_WITHDRAWAL' | 'CRYPTO_TRADE' | 'CRYPTO_TRANSFER'
  | 'GAME_MATCH_START' | 'GAME_MATCH_END' | 'GAME_DECK_CHANGE' | 'GAME_PURCHASE'
  | 'SECURITY_SUSPICIOUS_ACTIVITY' | 'SECURITY_RATE_LIMIT' | 'SECURITY_BOT_DETECTED'
  | 'ADMIN_USER_BAN' | 'ADMIN_USER_UNBAN' | 'ADMIN_CONFIG_CHANGE'
  | 'SYSTEM_ERROR' | 'SYSTEM_STARTUP' | 'SYSTEM_SHUTDOWN';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  username?: string;
  ip: string;
  userAgent?: string;
  action: string;
  details: Record<string, any>;
  success: boolean;
  error?: string;
  sessionId?: string;
  fingerprint: string; // Hash de l'événement pour vérifier l'intégrité
}

export interface AlertThreshold {
  eventType: AuditEventType;
  count: number;
  timeWindow: number; // en millisecondes
  severity: AuditSeverity;
}

class AuditLogger {
  private logDir: string;
  private currentLogFile: string;
  private alertThresholds: AlertThreshold[];
  private eventCounters: Map<string, { count: number; firstSeen: number }>;
  private isEnabled: boolean;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'audit');
    this.currentLogFile = this.getLogFileName();
    this.eventCounters = new Map();
    this.isEnabled = securityManager.getAuditConfig().enableFullLogging;
    
    this.alertThresholds = [
      { eventType: 'AUTH_LOGIN_FAILED', count: 5, timeWindow: 15 * 60 * 1000, severity: 'HIGH' },
      { eventType: 'SECURITY_SUSPICIOUS_ACTIVITY', count: 3, timeWindow: 10 * 60 * 1000, severity: 'CRITICAL' },
      { eventType: 'CRYPTO_WITHDRAWAL', count: 10, timeWindow: 60 * 60 * 1000, severity: 'MEDIUM' },
      { eventType: 'SECURITY_BOT_DETECTED', count: 1, timeWindow: 5 * 60 * 1000, severity: 'CRITICAL' },
      { eventType: 'ADMIN_USER_BAN', count: 5, timeWindow: 60 * 60 * 1000, severity: 'HIGH' },
    ];

    this.initializeLogDirectory();
    this.startLogRotation();
  }

  private initializeLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `audit-${date}.log`);
  }

  private generateFingerprint(event: Omit<AuditEvent, 'fingerprint'>): string {
    const data = JSON.stringify(event, Object.keys(event).sort());
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private startLogRotation(): void {
    // Rotation quotidienne des logs
    setInterval(() => {
      const newLogFile = this.getLogFileName();
      if (newLogFile !== this.currentLogFile) {
        this.currentLogFile = newLogFile;
        this.cleanOldLogs();
      }
    }, 60 * 60 * 1000); // Vérifier chaque heure
  }

  private cleanOldLogs(): void {
    const retentionDays = securityManager.getAuditConfig().retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const files = fs.readdirSync(this.logDir);
      for (const file of files) {
        if (file.startsWith('audit-') && file.endsWith('.log')) {
          const fileDate = file.match(/audit-(\d{4}-\d{2}-\d{2})\.log/);
          if (fileDate) {
            const logDate = new Date(fileDate[1]);
            if (logDate < cutoffDate) {
              fs.unlinkSync(path.join(this.logDir, file));
              console.log(`🗑️ Log ancien supprimé: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur nettoyage logs:', error);
    }
  }

  public async logEvent(
    type: AuditEventType,
    action: string,
    options: {
      userId?: string;
      username?: string;
      ip: string;
      userAgent?: string;
      details?: Record<string, any>;
      success: boolean;
      error?: string;
      sessionId?: string;
      severity?: AuditSeverity;
    }
  ): Promise<void> {
    if (!this.isEnabled && !this.isCriticalEvent(type)) {
      return; // Skip non-critical events si logging désactivé
    }

    const eventId = securityManager.generateSecureToken(16);
    const severity = options.severity || this.getSeverityForEventType(type);

    const eventData: Omit<AuditEvent, 'fingerprint'> = {
      id: eventId,
      timestamp: new Date().toISOString(),
      type,
      severity,
      userId: options.userId,
      username: options.username,
      ip: options.ip,
      userAgent: options.userAgent,
      action,
      details: options.details || {},
      success: options.success,
      error: options.error,
      sessionId: options.sessionId,
    };

    const fingerprint = this.generateFingerprint(eventData);
    const event: AuditEvent = { ...eventData, fingerprint };

    // Écriture asynchrone pour éviter les blocages
    this.writeToLog(event);

    // Vérifier les seuils d'alerte
    this.checkAlertThresholds(event);

    // Log console pour les événements critiques
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      console.warn(`🚨 AUDIT ${severity}: ${type} - ${action}`, {
        userId: options.userId,
        ip: options.ip,
        success: options.success,
      });
    }
  }

  private writeToLog(event: AuditEvent): void {
    const logLine = JSON.stringify(event) + '\n';
    
    try {
      fs.appendFileSync(this.currentLogFile, logLine, 'utf8');
    } catch (error) {
      console.error('❌ Erreur écriture audit log:', error);
      // Fallback: log en console si impossible d'écrire sur disque
      console.warn('📝 AUDIT FALLBACK:', event);
    }
  }

  private isCriticalEvent(type: AuditEventType): boolean {
    const criticalEvents: AuditEventType[] = [
      'AUTH_LOGIN_FAILED',
      'CRYPTO_WITHDRAWAL',
      'SECURITY_SUSPICIOUS_ACTIVITY',
      'SECURITY_BOT_DETECTED',
      'ADMIN_USER_BAN',
      'SYSTEM_ERROR',
    ];
    return criticalEvents.includes(type);
  }

  private getSeverityForEventType(type: AuditEventType): AuditSeverity {
    const severityMap: Record<AuditEventType, AuditSeverity> = {
      // Auth events
      'AUTH_LOGIN_SUCCESS': 'LOW',
      'AUTH_LOGIN_FAILED': 'MEDIUM',
      'AUTH_REGISTER': 'LOW',
      'AUTH_LOGOUT': 'LOW',
      'AUTH_TOKEN_REFRESH': 'LOW',
      'AUTH_PASSWORD_CHANGE': 'MEDIUM',
      'AUTH_EMAIL_CHANGE': 'MEDIUM',
      
      // Crypto events
      'CRYPTO_DEPOSIT': 'MEDIUM',
      'CRYPTO_WITHDRAWAL': 'HIGH',
      'CRYPTO_TRADE': 'MEDIUM',
      'CRYPTO_TRANSFER': 'HIGH',
      
      // Game events
      'GAME_MATCH_START': 'LOW',
      'GAME_MATCH_END': 'LOW',
      'GAME_DECK_CHANGE': 'LOW',
      'GAME_PURCHASE': 'LOW',
      
      // Security events
      'SECURITY_SUSPICIOUS_ACTIVITY': 'CRITICAL',
      'SECURITY_RATE_LIMIT': 'MEDIUM',
      'SECURITY_BOT_DETECTED': 'CRITICAL',
      
      // Admin events
      'ADMIN_USER_BAN': 'HIGH',
      'ADMIN_USER_UNBAN': 'HIGH',
      'ADMIN_CONFIG_CHANGE': 'HIGH',
      
      // System events
      'SYSTEM_ERROR': 'HIGH',
      'SYSTEM_STARTUP': 'MEDIUM',
      'SYSTEM_SHUTDOWN': 'MEDIUM',
    };

    return severityMap[type] || 'LOW';
  }

  private checkAlertThresholds(event: AuditEvent): void {
    const threshold = this.alertThresholds.find(t => t.eventType === event.type);
    if (!threshold) return;

    const key = `${event.type}-${event.ip}`;
    const now = Date.now();
    const counter = this.eventCounters.get(key);

    if (!counter) {
      this.eventCounters.set(key, { count: 1, firstSeen: now });
      return;
    }

    // Reset counter si en dehors de la fenêtre temporelle
    if (now - counter.firstSeen > threshold.timeWindow) {
      this.eventCounters.set(key, { count: 1, firstSeen: now });
      return;
    }

    counter.count++;

    // Déclencher alerte si seuil atteint
    if (counter.count >= threshold.count) {
      this.triggerAlert(event, threshold, counter.count);
      // Reset pour éviter spam d'alertes
      this.eventCounters.delete(key);
    }
  }

  private triggerAlert(event: AuditEvent, threshold: AlertThreshold, count: number): void {
    const alertData = {
      alertId: securityManager.generateSecureToken(16),
      timestamp: new Date().toISOString(),
      type: 'SECURITY_ALERT',
      severity: threshold.severity,
      message: `Seuil d'alerte atteint: ${threshold.eventType}`,
      details: {
        eventType: threshold.eventType,
        threshold: threshold.count,
        actualCount: count,
        timeWindow: threshold.timeWindow,
        triggeringEvent: event,
      },
    };

    // Log l'alerte
    this.writeToLog(alertData as any);

    // Notification console
    console.error(`🚨 ALERTE SÉCURITÉ ${threshold.severity}:`, {
      type: threshold.eventType,
      count,
      threshold: threshold.count,
      ip: event.ip,
      userId: event.userId,
    });

    // TODO: Intégrer avec un système d'alertes externes (email, Slack, etc.)
    // this.sendExternalAlert(alertData);
  }

  // Méthodes de requête pour analytics/admin
  public async queryEvents(
    filter: {
      eventType?: AuditEventType;
      userId?: string;
      ip?: string;
      startDate?: Date;
      endDate?: Date;
      severity?: AuditSeverity;
      success?: boolean;
    },
    limit: number = 100
  ): Promise<AuditEvent[]> {
    // TODO: Implémenter avec une vraie base de données pour de meilleures performances
    // Pour l'instant, lecture des fichiers logs (basique)
    return [];
  }

  public getStats(): {
    totalEvents: number;
    eventsByType: Record<AuditEventType, number>;
    eventsBySeverity: Record<AuditSeverity, number>;
    recentAlerts: number;
  } {
    // TODO: Implémenter stats basées sur les logs
    return {
      totalEvents: 0,
      eventsByType: {} as any,
      eventsBySeverity: {} as any,
      recentAlerts: 0,
    };
  }
}

// Export singleton
export const auditLogger = new AuditLogger();
export default auditLogger;
