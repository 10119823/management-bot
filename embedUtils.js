const { EmbedBuilder } = require('discord.js');
const moment = require('moment');

// Premium color scheme with gradients and effects
const COLORS = {
    SUCCESS: '#00ff88',      // Bright green for success actions
    WARNING: '#ffaa00',      // Orange for warnings
    ERROR: '#ff4444',        // Red for errors/bans
    INFO: '#0099ff',         // Blue for information
    NEUTRAL: '#7289da',      // Discord blurple for neutral actions
    DANGER: '#ff0000',       // Bright red for dangerous actions
    MUTED: '#99aab5',        // Gray for muted actions
    PREMIUM: '#ffd700',      // Gold for premium features
    GRADIENT_START: '#667eea', // Gradient start
    GRADIENT_END: '#764ba2',   // Gradient end
    PREMIUM_GOLD: '#ffd700',   // Premium gold
    PREMIUM_SILVER: '#c0c0c0', // Premium silver
    PREMIUM_PLATINUM: '#e5e4e2', // Premium platinum
    ANIMATED_BLUE: '#00d4ff',   // Animated blue
    ANIMATED_PURPLE: '#8b5cf6', // Animated purple
    ANIMATED_PINK: '#ec4899'    // Animated pink
};

// Action-specific colors
const ACTION_COLORS = {
    'ban': COLORS.ERROR,
    'kick': COLORS.WARNING,
    'warn': COLORS.WARNING,
    'mute': COLORS.WARNING,
    'unmute': COLORS.SUCCESS,
    'unban': COLORS.SUCCESS,
    'blacklist': COLORS.DANGER,
    'unblacklist': COLORS.SUCCESS,
    'purge': COLORS.WARNING,
    'welcome': COLORS.SUCCESS,
    'info': COLORS.INFO,
    'stats': COLORS.INFO,
    'automod': COLORS.PREMIUM
};

// Premium animated icons for different actions
const ACTION_ICONS = {
    'ban': '<a:ban_hammer:1234567890123456789>', // Animated ban hammer
    'kick': '<a:kick_boot:1234567890123456789>', // Animated kick boot
    'warn': '<a:warning_sign:1234567890123456789>', // Animated warning
    'mute': '<a:mute_speaker:1234567890123456789>', // Animated mute
    'unmute': '<a:unmute_speaker:1234567890123456789>', // Animated unmute
    'unban': '<a:unlock:1234567890123456789>', // Animated unlock
    'blacklist': '<a:no_entry:1234567890123456789>', // Animated no entry
    'unblacklist': '<a:check_mark:1234567890123456789>', // Animated check
    'purge': '<a:trash_can:1234567890123456789>', // Animated trash
    'welcome': '<a:party_popper:1234567890123456789>', // Animated party
    'info': '<a:information:1234567890123456789>', // Animated info
    'stats': '<a:chart_bar:1234567890123456789>', // Animated chart
    'automod': '<a:gear_spinning:1234567890123456789>', // Animated gear
    'warning': '<a:warning_triangle:1234567890123456789>', // Animated warning
    'error': '<a:cross_mark:1234567890123456789>', // Animated cross
    'success': '<a:check_mark_button:1234567890123456789>', // Animated check
    'premium': '<a:star_sparkle:1234567890123456789>', // Animated star
    'loading': '<a:loading_spinner:1234567890123456789>', // Animated loading
    'shield': '<a:shield_check:1234567890123456789>', // Animated shield
    'crown': '<a:crown_sparkle:1234567890123456789>' // Animated crown
};

class EmbedManager {
    constructor() {
        this.botName = 'Moderation Bot';
        this.botIcon = 'https://cdn.discordapp.com/emojis/1234567890123456789.png'; // Replace with actual bot icon
    }

    /**
     * Create a professional moderation log embed
     * @param {string} action - The moderation action
     * @param {Object} user - User object with tag and id
     * @param {Object} moderator - Moderator object with tag
     * @param {string} reason - Reason for the action
     * @param {Object} additionalInfo - Additional information like duration
     * @returns {EmbedBuilder}
     */
    createModerationEmbed(action, user, moderator, reason = null, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS[action.toLowerCase()] || '🔧'} ${this.formatActionTitle(action)}`)
            .setColor(ACTION_COLORS[action.toLowerCase()] || COLORS.NEUTRAL)
            .setTimestamp()
            .setFooter({ 
                text: this.botName,
                iconURL: this.botIcon
            });

        // Add user information
        if (user) {
            embed.addFields({
                name: '👤 User',
                value: `**${user.tag || user.id}**\n\`${user.id}\``,
                inline: true
            });
        }

        // Add moderator information
        if (moderator) {
            embed.addFields({
                name: '🛡️ Moderator',
                value: `**${moderator.tag}**`,
                inline: true
            });
        }

        // Add reason
        embed.addFields({
            name: '📝 Reason',
            value: reason || '*No reason provided*',
            inline: false
        });

        // Add additional information
        if (additionalInfo.duration) {
            embed.addFields({
                name: '⏱️ Duration',
                value: `**${additionalInfo.duration}**`,
                inline: true
            });
        }

        if (additionalInfo.channel) {
            embed.addFields({
                name: '📍 Channel',
                value: `<#${additionalInfo.channel}>`,
                inline: true
            });
        }

        return embed;
    }

    /**
     * Create a user information embed
     * @param {Object} user - Discord user object
     * @param {Object} profile - User profile data from database
     * @returns {EmbedBuilder}
     */
    createUserInfoEmbed(user, profile = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.info} User Information`)
            .setDescription(`**${user.tag}**`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor(COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: this.botName,
                iconURL: this.botIcon
            });

        // User details
        embed.addFields(
            {
                name: '🆔 User ID',
                value: `\`${user.id}\``,
                inline: true
            },
            {
                name: '📅 Account Created',
                value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
                inline: true
            },
            {
                name: '🤖 Bot Account',
                value: user.bot ? 'Yes' : 'No',
                inline: true
            }
        );

        // Moderation history
        embed.addFields(
            {
                name: '⚠️ Warnings',
                value: `**${profile.warnings || 0}**`,
                inline: true
            },
            {
                name: '👢 Kicks',
                value: `**${profile.kicks || 0}**`,
                inline: true
            },
            {
                name: '🔨 Bans',
                value: `**${profile.bans || 0}**`,
                inline: true
            }
        );

        // Server information
        if (profile.join_date) {
            embed.addFields({
                name: '📥 Join Date',
                value: `<t:${Math.floor(new Date(profile.join_date).getTime() / 1000)}:F>`,
                inline: true
            });
        }

        if (profile.last_seen) {
            embed.addFields({
                name: '👁️ Last Seen',
                value: `<t:${Math.floor(new Date(profile.last_seen).getTime() / 1000)}:R>`,
                inline: true
            });
        }

        return embed;
    }

    /**
     * Create a welcome embed
     * @param {Object} member - Guild member object
     * @returns {EmbedBuilder}
     */
    createWelcomeEmbed(member) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.welcome} Welcome to the Server!`)
            .setDescription(`Welcome to **${member.guild.name}**, ${member.user}!`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor(COLORS.SUCCESS)
            .setTimestamp()
            .setFooter({ 
                text: `Member #${member.guild.memberCount}`,
                iconURL: this.botIcon
            });

        embed.addFields({
            name: '📋 Server Rules',
            value: 'Please read the rules and guidelines in <#rules-channel>',
            inline: false
        });

        return embed;
    }

    /**
     * Create a server statistics embed
     * @param {Object} guild - Discord guild object
     * @returns {EmbedBuilder}
     */
    createStatsEmbed(guild) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.stats} Server Statistics`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setColor(COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: this.botName,
                iconURL: this.botIcon
            });

        // Server information
        embed.addFields(
            {
                name: '👥 Members',
                value: `**Total:** ${guild.memberCount}\n**Online:** ${guild.members.cache.filter(member => member.presence?.status === 'online').size}`,
                inline: true
            },
            {
                name: '📺 Channels',
                value: `**Text:** ${guild.channels.cache.filter(channel => channel.type === 0).size}\n**Voice:** ${guild.channels.cache.filter(channel => channel.type === 2).size}`,
                inline: true
            },
            {
                name: '🎭 Roles',
                value: `**${guild.roles.cache.size}** roles`,
                inline: true
            }
        );

        // Server details
        embed.addFields({
            name: '📅 Server Created',
            value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
            inline: true
        });

        if (guild.ownerId) {
            const owner = guild.members.cache.get(guild.ownerId);
            if (owner) {
                embed.addFields({
                    name: '👑 Owner',
                    value: `**${owner.user.tag}**`,
                    inline: true
                });
            }
        }

        return embed;
    }

    /**
     * Create an error embed
     * @param {string} title - Error title
     * @param {string} description - Error description
     * @param {string} action - Action that caused the error
     * @returns {EmbedBuilder}
     */
    createErrorEmbed(title, description, action = null) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.error} ${title}`)
            .setDescription(description)
            .setColor(COLORS.ERROR)
            .setTimestamp()
            .setFooter({ 
                text: this.botName,
                iconURL: this.botIcon
            });

        if (action) {
            embed.addFields({
                name: '🔧 Action',
                value: action,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create a success embed
     * @param {string} title - Success title
     * @param {string} description - Success description
     * @param {Object} additionalInfo - Additional information
     * @returns {EmbedBuilder}
     */
    createSuccessEmbed(title, description, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.success} ${title}`)
            .setDescription(description)
            .setColor(COLORS.SUCCESS)
            .setTimestamp()
            .setFooter({ 
                text: this.botName,
                iconURL: this.botIcon
            });

        // Add additional fields if provided
        Object.entries(additionalInfo).forEach(([key, value]) => {
            if (value) {
                embed.addFields({
                    name: this.formatFieldName(key),
                    value: value,
                    inline: true
                });
            }
        });

        return embed;
    }

    /**
     * Format action title for display
     * @param {string} action - Raw action name
     * @returns {string}
     */
    formatActionTitle(action) {
        return action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
    }

    /**
     * Format field name for display
     * @param {string} fieldName - Raw field name
     * @returns {string}
     */
    formatFieldName(fieldName) {
        const fieldMap = {
            'duration': '⏱️ Duration',
            'channel': '📍 Channel',
            'user': '👤 User',
            'moderator': '🛡️ Moderator',
            'reason': '📝 Reason',
            'count': '📊 Count',
            'type': '🏷️ Type'
        };

        return fieldMap[fieldName] || `📋 ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
    }

    /**
     * Create a custom embed with professional styling
     * @param {Object} options - Embed options
     * @returns {EmbedBuilder}
     */
    createCustomEmbed(options = {}) {
        const embed = new EmbedBuilder()
            .setColor(options.color || COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: options.footer || this.botName,
                iconURL: options.footerIcon || this.botIcon
            });

        if (options.title) embed.setTitle(options.title);
        if (options.description) embed.setDescription(options.description);
        if (options.thumbnail) embed.setThumbnail(options.thumbnail);
        if (options.image) embed.setImage(options.image);
        if (options.fields) {
            options.fields.forEach(field => {
                embed.addFields(field);
            });
        }

        return embed;
    }

    /**
     * Create a permission denied embed
     * @param {string} command - Command that was denied
     * @returns {EmbedBuilder}
     */
    createPermissionDeniedEmbed(command) {
        return this.createErrorEmbed(
            'Permission Denied',
            'You do not have permission to use this command.',
            command
        );
    }

    /**
     * Create a self-action denied embed
     * @param {string} action - Action that was denied
     * @returns {EmbedBuilder}
     */
    createSelfActionDeniedEmbed(action) {
        return this.createErrorEmbed(
            'Invalid Action',
            `You cannot ${action} yourself.`,
            action
        );
    }
}

// Export the embed manager instance
module.exports = new EmbedManager();