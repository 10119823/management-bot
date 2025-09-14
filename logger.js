const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
const embedManager = require('./embedUtils');

class PremiumLogger {
    constructor() {
        this.logLevels = {
            DEBUG: { color: '#99aab5', icon: '🔍', priority: 0 },
            INFO: { color: '#0099ff', icon: 'ℹ️', priority: 1 },
            WARN: { color: '#ffaa00', icon: '⚠️', priority: 2 },
            ERROR: { color: '#ff4444', icon: '❌', priority: 3 },
            CRITICAL: { color: '#ff0000', icon: '🚨', priority: 4 }
        };
        this.logHistory = [];
        this.maxHistorySize = 1000;
    }

    /**
     * Create a premium log entry
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} - Log entry
     */
    createLogEntry(level, message, metadata = {}) {
        const logEntry = {
            id: this.generateLogId(),
            timestamp: new Date(),
            level: level.toUpperCase(),
            message,
            metadata,
            formatted: this.formatLogMessage(level, message, metadata)
        };

        this.addToHistory(logEntry);
        return logEntry;
    }

    /**
     * Create a beautiful log embed
     * @param {Object} logEntry - Log entry object
     * @returns {EmbedBuilder}
     */
    createLogEmbed(logEntry) {
        const levelConfig = this.logLevels[logEntry.level];
        const embed = new EmbedBuilder()
            .setTitle(`${levelConfig.icon} ${logEntry.level} Log Entry`)
            .setDescription(logEntry.message)
            .setColor(levelConfig.color)
            .setTimestamp(logEntry.timestamp)
            .setFooter({ 
                text: `Log ID: ${logEntry.id} • Premium Logger`,
                iconURL: 'https://cdn.discordapp.com/emojis/logger-icon.png'
            });

        // Add metadata fields
        if (logEntry.metadata.user) {
            embed.addFields({
                name: '👤 User',
                value: `**${logEntry.metadata.user.tag}**\n\`${logEntry.metadata.user.id}\``,
                inline: true
            });
        }

        if (logEntry.metadata.action) {
            embed.addFields({
                name: '🔧 Action',
                value: logEntry.metadata.action,
                inline: true
            });
        }

        if (logEntry.metadata.server) {
            embed.addFields({
                name: '🏠 Server',
                value: logEntry.metadata.server,
                inline: true
            });
        }

        if (logEntry.metadata.details) {
            embed.addFields({
                name: '📋 Details',
                value: logEntry.metadata.details,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create a comprehensive audit log
     * @param {string} action - Action performed
     * @param {Object} user - User who performed the action
     * @param {Object} target - Target of the action
     * @param {Object} details - Additional details
     * @returns {EmbedBuilder}
     */
    createAuditLog(action, user, target, details = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.shield} Audit Log Entry`)
            .setDescription(`**${action}** performed by ${user.tag}`)
            .setColor(embedManager.COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Audit System • Secure Logging',
                iconURL: 'https://cdn.discordapp.com/emojis/audit-icon.png'
            });

        // Action details
        embed.addFields({
            name: '🔧 Action Details',
            value: `**Type:** ${action}\n**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Severity:** ${details.severity || 'Medium'}`,
            inline: true
        });

        // User information
        embed.addFields({
            name: '👤 Performed By',
            value: `**${user.tag}**\n\`${user.id}\`\n**Role:** ${details.userRole || 'Member'}`,
            inline: true
        });

        // Target information
        if (target) {
            embed.addFields({
                name: '🎯 Target',
                value: `**${target.tag || target.id}**\n\`${target.id}\`\n**Type:** ${target.bot ? 'Bot' : 'User'}`,
                inline: true
            });
        }

        // Additional details
        if (details.reason) {
            embed.addFields({
                name: '📝 Reason',
                value: details.reason,
                inline: false
            });
        }

        if (details.channel) {
            embed.addFields({
                name: '📍 Channel',
                value: `<#${details.channel}>`,
                inline: true
            });
        }

        return embed;
    }

    /**
     * Create a system status log
     * @param {Object} status - System status
     * @returns {EmbedBuilder}
     */
    createSystemStatusLog(status) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.automod} System Status Report`)
            .setDescription('Real-time system performance metrics')
            .setColor(status.healthy ? embedManager.COLORS.SUCCESS : embedManager.COLORS.ERROR)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium System Monitor • Auto-Generated',
                iconURL: 'https://cdn.discordapp.com/emojis/system-icon.png'
            });

        // Performance metrics
        embed.addFields({
            name: '⚡ Performance',
            value: `**Uptime:** ${status.uptime || '99.9%'}\n**Response Time:** ${status.responseTime || '<50ms'}\n**Memory:** ${status.memory || '45%'}\n**CPU:** ${status.cpu || '12%'}`,
            inline: true
        });

        // Bot statistics
        embed.addFields({
            name: '🤖 Bot Stats',
            value: `**Servers:** ${status.servers || 0}\n**Users:** ${status.users || 0}\n**Commands:** ${status.commands || 0}\n**Errors:** ${status.errors || 0}`,
            inline: true
        });

        // Feature status
        embed.addFields({
            name: '🔧 Features',
            value: `**Auto-Mod:** ${status.autoMod ? '✅' : '❌'}\n**Logging:** ${status.logging ? '✅' : '❌'}\n**Analytics:** ${status.analytics ? '✅' : '❌'}\n**Premium:** ${status.premium ? '✅' : '❌'}`,
            inline: true
        });

        return embed;
    }

    /**
     * Create a security alert log
     * @param {string} alertType - Type of security alert
     * @param {Object} details - Alert details
     * @returns {EmbedBuilder}
     */
    createSecurityAlertLog(alertType, details) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.error} Security Alert`)
            .setDescription(`**${alertType}** detected and handled`)
            .setColor(embedManager.COLORS.DANGER)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Security System • Auto-Response',
                iconURL: 'https://cdn.discordapp.com/emojis/security-icon.png'
            });

        // Alert details
        embed.addFields({
            name: '🚨 Alert Details',
            value: `**Type:** ${alertType}\n**Severity:** ${details.severity || 'High'}\n**Source:** ${details.source || 'Unknown'}\n**Status:** ${details.status || 'Active'}`,
            inline: true
        });

        // Action taken
        embed.addFields({
            name: '🛡️ Action Taken',
            value: details.action || 'Automatic response triggered',
            inline: true
        });

        // Additional info
        if (details.user) {
            embed.addFields({
                name: '👤 Related User',
                value: `**${details.user.tag}**\n\`${details.user.id}\``,
                inline: true
            });
        }

        return embed;
    }

    /**
     * Format log message with styling
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     * @returns {string}
     */
    formatLogMessage(level, message, metadata) {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const levelConfig = this.logLevels[level.toUpperCase()];
        let formatted = `[${timestamp}] ${levelConfig.icon} ${level.toUpperCase()}: ${message}`;

        if (metadata.user) {
            formatted += ` | User: ${metadata.user.tag}`;
        }

        if (metadata.action) {
            formatted += ` | Action: ${metadata.action}`;
        }

        return formatted;
    }

    /**
     * Generate unique log ID
     * @returns {string}
     */
    generateLogId() {
        return `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add log entry to history
     * @param {Object} logEntry - Log entry
     */
    addToHistory(logEntry) {
        this.logHistory.push(logEntry);
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }
    }

    /**
     * Get log history
     * @param {number} limit - Number of logs to return
     * @returns {Array}
     */
    getLogHistory(limit = 50) {
        return this.logHistory.slice(-limit);
    }

    /**
     * Create a log summary embed
     * @param {number} hours - Hours to summarize
     * @returns {EmbedBuilder}
     */
    createLogSummaryEmbed(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const recentLogs = this.logHistory.filter(log => log.timestamp > cutoff);

        const levelCounts = {};
        recentLogs.forEach(log => {
            levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
        });

        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.stats} Log Summary (Last ${hours}h)`)
            .setDescription(`Total logs: **${recentLogs.length}**`)
            .setColor(embedManager.COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Logger • Summary Report',
                iconURL: 'https://cdn.discordapp.com/emojis/summary-icon.png'
            });

        // Log level breakdown
        Object.entries(levelCounts).forEach(([level, count]) => {
            const levelConfig = this.logLevels[level];
            embed.addFields({
                name: `${levelConfig.icon} ${level}`,
                value: `**${count}** entries`,
                inline: true
            });
        });

        return embed;
    }
}

module.exports = new PremiumLogger();