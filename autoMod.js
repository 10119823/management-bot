const { EmbedBuilder } = require('discord.js');
const embedManager = require('./embedUtils');
const logger = require('./logger');

class AdvancedAutoMod {
    constructor() {
        this.rules = {
            spam: {
                enabled: true,
                threshold: 5,
                timeframe: 10000, // 10 seconds
                action: 'delete_and_warn'
            },
            profanity: {
                enabled: true,
                words: ['badword1', 'badword2'], // Add your list
                action: 'delete_and_warn'
            },
            caps: {
                enabled: true,
                threshold: 0.7, // 70% caps
                action: 'warn'
            },
            links: {
                enabled: true,
                allowed: ['discord.gg', 'youtube.com', 'twitch.tv'],
                action: 'delete_and_warn'
            },
            mentions: {
                enabled: true,
                threshold: 5,
                action: 'warn'
            },
            invites: {
                enabled: true,
                action: 'delete_and_warn'
            }
        };
        this.userViolations = new Map();
        this.autoActions = new Map();
    }

    /**
     * Process a message for auto-moderation
     * @param {Object} message - Discord message object
     * @returns {Promise<boolean>} - Whether action was taken
     */
    async processMessage(message) {
        if (message.author.bot) return false;

        const violations = [];
        const content = message.content.toLowerCase();

        // Check for spam
        if (this.rules.spam.enabled) {
            const spamViolation = await this.checkSpam(message);
            if (spamViolation) violations.push(spamViolation);
        }

        // Check for profanity
        if (this.rules.profanity.enabled) {
            const profanityViolation = this.checkProfanity(message);
            if (profanityViolation) violations.push(profanityViolation);
        }

        // Check for excessive caps
        if (this.rules.caps.enabled) {
            const capsViolation = this.checkCaps(message);
            if (capsViolation) violations.push(capsViolation);
        }

        // Check for links
        if (this.rules.links.enabled) {
            const linkViolation = this.checkLinks(message);
            if (linkViolation) violations.push(linkViolation);
        }

        // Check for excessive mentions
        if (this.rules.mentions.enabled) {
            const mentionViolation = this.checkMentions(message);
            if (mentionViolation) violations.push(mentionViolation);
        }

        // Check for invites
        if (this.rules.invites.enabled) {
            const inviteViolation = this.checkInvites(message);
            if (inviteViolation) violations.push(inviteViolation);
        }

        // Process violations
        if (violations.length > 0) {
            await this.handleViolations(message, violations);
            return true;
        }

        return false;
    }

    /**
     * Check for spam violations
     * @param {Object} message - Discord message object
     * @returns {Promise<Object|null>}
     */
    async checkSpam(message) {
        const userId = message.author.id;
        const now = Date.now();
        const timeframe = this.rules.spam.timeframe;

        // Get user's recent messages
        const recentMessages = message.channel.messages.cache
            .filter(m => m.author.id === userId && now - m.createdTimestamp < timeframe);

        if (recentMessages.size >= this.rules.spam.threshold) {
            return {
                type: 'spam',
                severity: 'medium',
                reason: `Sent ${recentMessages.size} messages in ${timeframe / 1000} seconds`,
                action: this.rules.spam.action
            };
        }

        return null;
    }

    /**
     * Check for profanity violations
     * @param {Object} message - Discord message object
     * @returns {Object|null}
     */
    checkProfanity(message) {
        const content = message.content.toLowerCase();
        const foundWords = this.rules.profanity.words.filter(word => content.includes(word));

        if (foundWords.length > 0) {
            return {
                type: 'profanity',
                severity: 'high',
                reason: `Used inappropriate language: ${foundWords.join(', ')}`,
                action: this.rules.profanity.action
            };
        }

        return null;
    }

    /**
     * Check for excessive caps violations
     * @param {Object} message - Discord message object
     * @returns {Object|null}
     */
    checkCaps(message) {
        const content = message.content;
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const totalLetters = (content.match(/[A-Za-z]/g) || []).length;

        if (totalLetters > 0) {
            const capsRatio = capsCount / totalLetters;
            if (capsRatio >= this.rules.caps.threshold) {
                return {
                    type: 'caps',
                    severity: 'low',
                    reason: `Excessive caps usage: ${Math.round(capsRatio * 100)}%`,
                    action: this.rules.caps.action
                };
            }
        }

        return null;
    }

    /**
     * Check for link violations
     * @param {Object} message - Discord message object
     * @returns {Object|null}
     */
    checkLinks(message) {
        const content = message.content;
        const linkRegex = /https?:\/\/[^\s]+/g;
        const links = content.match(linkRegex) || [];

        if (links.length > 0) {
            const unauthorizedLinks = links.filter(link => 
                !this.rules.links.allowed.some(allowed => link.includes(allowed))
            );

            if (unauthorizedLinks.length > 0) {
                return {
                    type: 'links',
                    severity: 'medium',
                    reason: `Posted unauthorized links: ${unauthorizedLinks.join(', ')}`,
                    action: this.rules.links.action
                };
            }
        }

        return null;
    }

    /**
     * Check for mention violations
     * @param {Object} message - Discord message object
     * @returns {Object|null}
     */
    checkMentions(message) {
        const mentions = message.mentions.users.size + message.mentions.roles.size;

        if (mentions >= this.rules.mentions.threshold) {
            return {
                type: 'mentions',
                severity: 'medium',
                reason: `Excessive mentions: ${mentions} in one message`,
                action: this.rules.mentions.action
            };
        }

        return null;
    }

    /**
     * Check for invite violations
     * @param {Object} message - Discord message object
     * @returns {Object|null}
     */
    checkInvites(message) {
        const content = message.content;
        const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/g;
        const invites = content.match(inviteRegex) || [];

        if (invites.length > 0) {
            return {
                type: 'invites',
                severity: 'high',
                reason: `Posted Discord invite: ${invites.join(', ')}`,
                action: this.rules.invites.action
            };
        }

        return null;
    }

    /**
     * Handle violations and take appropriate action
     * @param {Object} message - Discord message object
     * @param {Array} violations - Array of violations
     */
    async handleViolations(message, violations) {
        const userId = message.author.id;
        const highestSeverity = this.getHighestSeverity(violations);

        // Log violations
        logger.createLogEntry('WARN', `Auto-mod violation detected`, {
            user: message.author,
            action: 'auto_moderation',
            server: message.guild.name,
            details: violations.map(v => v.type).join(', ')
        });

        // Update user violation count
        const currentViolations = this.userViolations.get(userId) || 0;
        this.userViolations.set(userId, currentViolations + 1);

        // Take action based on severity and rules
        for (const violation of violations) {
            await this.executeAction(message, violation);
        }

        // Send auto-mod notification
        await this.sendAutoModNotification(message, violations);
    }

    /**
     * Execute auto-moderation action
     * @param {Object} message - Discord message object
     * @param {Object} violation - Violation object
     */
    async executeAction(message, violation) {
        const { action, type, reason } = violation;

        switch (action) {
            case 'delete':
                await message.delete();
                break;

            case 'warn':
                await this.sendWarning(message, type, reason);
                break;

            case 'delete_and_warn':
                await message.delete();
                await this.sendWarning(message, type, reason);
                break;

            case 'timeout':
                try {
                    await message.member.timeout(5 * 60 * 1000, `Auto-mod: ${reason}`);
                } catch (error) {
                    console.error('Failed to timeout user:', error);
                }
                break;

            case 'kick':
                try {
                    await message.member.kick(`Auto-mod: ${reason}`);
                } catch (error) {
                    console.error('Failed to kick user:', error);
                }
                break;
        }
    }

    /**
     * Send warning message to user
     * @param {Object} message - Discord message object
     * @param {string} type - Violation type
     * @param {string} reason - Violation reason
     */
    async sendWarning(message, type, reason) {
        const embed = embedManager.createErrorEmbed(
            'Auto-Moderation Warning',
            `Your message was flagged by our automatic moderation system.`,
            'auto_moderation'
        );

        embed.addFields({
            name: '⚠️ Violation Details',
            value: `**Type:** ${type}\n**Reason:** ${reason}\n**Channel:** <#${message.channel.id}>`,
            inline: false
        });

        embed.addFields({
            name: '📋 Server Rules',
            value: 'Please review our server rules to avoid future violations.',
            inline: false
        });

        try {
            await message.author.send({ embeds: [embed] });
        } catch (error) {
            // User has DMs disabled, send in channel
            const channelEmbed = embedManager.createErrorEmbed(
                'Auto-Moderation Warning',
                `${message.author}, your message was flagged by our automatic moderation system.`,
                'auto_moderation'
            );
            await message.channel.send({ embeds: [channelEmbed] });
        }
    }

    /**
     * Send auto-moderation notification to moderators
     * @param {Object} message - Discord message object
     * @param {Array} violations - Array of violations
     */
    async sendAutoModNotification(message, violations) {
        const logChannel = message.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (!logChannel) return;

        const embed = embedManager.createModerationEmbed(
            'Auto-Moderation',
            message.author,
            { tag: 'Auto-Moderation System' },
            violations.map(v => v.reason).join('; '),
            { 
                channel: message.channel.id,
                violations: violations.length,
                severity: this.getHighestSeverity(violations)
            }
        );

        await logChannel.send({ embeds: [embed] });
    }

    /**
     * Get highest severity from violations
     * @param {Array} violations - Array of violations
     * @returns {string}
     */
    getHighestSeverity(violations) {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        return violations.reduce((highest, violation) => 
            severityOrder[violation.severity] > severityOrder[highest] ? violation.severity : highest
        , 'low');
    }

    /**
     * Create auto-moderation settings embed
     * @returns {EmbedBuilder}
     */
    createSettingsEmbed() {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.automod} Auto-Moderation Settings`)
            .setDescription('Current auto-moderation configuration')
            .setColor(embedManager.COLORS.PREMIUM)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Auto-Moderation • AI-Powered',
                iconURL: 'https://cdn.discordapp.com/emojis/automod-icon.png'
            });

        // Add rule status
        Object.entries(this.rules).forEach(([rule, config]) => {
            embed.addFields({
                name: `${config.enabled ? '✅' : '❌'} ${rule.charAt(0).toUpperCase() + rule.slice(1)}`,
                value: `**Action:** ${config.action}\n**Threshold:** ${config.threshold || 'N/A'}\n**Status:** ${config.enabled ? 'Enabled' : 'Disabled'}`,
                inline: true
            });
        });

        return embed;
    }

    /**
     * Update auto-moderation rule
     * @param {string} rule - Rule name
     * @param {Object} config - New configuration
     */
    updateRule(rule, config) {
        if (this.rules[rule]) {
            this.rules[rule] = { ...this.rules[rule], ...config };
        }
    }

    /**
     * Get user violation count
     * @param {string} userId - User ID
     * @returns {number}
     */
    getUserViolations(userId) {
        return this.userViolations.get(userId) || 0;
    }

    /**
     * Reset user violations
     * @param {string} userId - User ID
     */
    resetUserViolations(userId) {
        this.userViolations.delete(userId);
    }
}

module.exports = new AdvancedAutoMod();