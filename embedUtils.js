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

    /**
     * Create a premium avatar embed
     * @param {Object} user - Discord user object
     * @param {string} size - Avatar size
     * @returns {EmbedBuilder}
     */
    createAvatarEmbed(user, size = '1024') {
        const avatarUrl = user.displayAvatarURL({ 
            dynamic: true, 
            size: parseInt(size),
            format: 'png'
        });

        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.info} Avatar Viewer`)
            .setDescription(`**${user.tag}'s Avatar**`)
            .setImage(avatarUrl)
            .setColor(COLORS.ANIMATED_PURPLE)
            .setTimestamp()
            .setFooter({ 
                text: `Premium Avatar Viewer • ${size}px`,
                iconURL: this.botIcon
            });

        // Add user information
        embed.addFields({
            name: '👤 User Information',
            value: `**Username:** ${user.tag}\n**ID:** \`${user.id}\`\n**Account Type:** ${user.bot ? 'Bot' : 'User'}`,
            inline: true
        });

        // Add avatar details
        embed.addFields({
            name: '🖼️ Avatar Details',
            value: `**Size:** ${size}px\n**Format:** PNG\n**Dynamic:** ${user.avatar ? 'Yes' : 'No'}\n**Animated:** ${user.avatar?.startsWith('a_') ? 'Yes' : 'No'}`,
            inline: true
        });

        // Add download links
        const downloadLinks = [];
        if (size !== '128') downloadLinks.push(`[128px](${user.displayAvatarURL({ size: 128, format: 'png' })})`);
        if (size !== '256') downloadLinks.push(`[256px](${user.displayAvatarURL({ size: 256, format: 'png' })})`);
        if (size !== '512') downloadLinks.push(`[512px](${user.displayAvatarURL({ size: 512, format: 'png' })})`);
        if (size !== '1024') downloadLinks.push(`[1024px](${user.displayAvatarURL({ size: 1024, format: 'png' })})`);
        if (size !== '2048') downloadLinks.push(`[2048px](${user.displayAvatarURL({ size: 2048, format: 'png' })})`);

        if (downloadLinks.length > 0) {
            embed.addFields({
                name: '📥 Download Links',
                value: downloadLinks.join(' • '),
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create a role management embed
     * @param {Object} role - Discord role object
     * @param {string} action - Action performed
     * @returns {EmbedBuilder}
     */
    createRoleEmbed(role, action) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.automod} Role ${action.charAt(0).toUpperCase() + action.slice(1)}`)
            .setDescription(`**${role.name}** has been ${action}d successfully`)
            .setColor(role.color || COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: `Premium Role Management • ${action}`,
                iconURL: this.botIcon
            });

        // Role details
        embed.addFields({
            name: '🎭 Role Information',
            value: `**Name:** ${role.name}\n**ID:** \`${role.id}\`\n**Color:** ${role.hexColor}\n**Position:** ${role.position}`,
            inline: true
        });

        // Role properties
        embed.addFields({
            name: '⚙️ Properties',
            value: `**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}\n**Hoisted:** ${role.hoist ? 'Yes' : 'No'}\n**Managed:** ${role.managed ? 'Yes' : 'No'}\n**Members:** ${role.members.size}`,
            inline: true
        });

        // Permissions (if any)
        if (role.permissions.bitfield > 0) {
            const permissions = role.permissions.toArray();
            const keyPermissions = permissions.filter(p => 
                ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'KickMembers', 'BanMembers'].includes(p)
            );
            
            if (keyPermissions.length > 0) {
                embed.addFields({
                    name: '🔑 Key Permissions',
                    value: keyPermissions.map(p => `• ${p}`).join('\n'),
                    inline: false
                });
            }
        }

        return embed;
    }

    /**
     * Create a role list embed
     * @param {Array} roles - Array of role objects
     * @returns {EmbedBuilder}
     */
    createRoleListEmbed(roles) {
        const embed = new EmbedBuilder()
            .setTitle(`${ACTION_ICONS.automod} Server Roles`)
            .setDescription(`**${roles.length}** roles found in this server`)
            .setColor(COLORS.INFO)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Role Management • Complete List',
                iconURL: this.botIcon
            });

        // Group roles by position
        const sortedRoles = roles.sort((a, b) => b.position - a.position);
        const roleGroups = {
            managed: sortedRoles.filter(r => r.managed),
            custom: sortedRoles.filter(r => !r.managed && r.id !== r.guild.id),
            everyone: sortedRoles.filter(r => r.id === r.guild.id)
        };

        // Add managed roles
        if (roleGroups.managed.length > 0) {
            const managedList = roleGroups.managed.slice(0, 10).map(role => 
                `${role.hexColor} **${role.name}** ${role.mentionable ? '🔔' : '🔕'} (${role.members.size} members)`
            ).join('\n');
            
            embed.addFields({
                name: '🤖 Managed Roles',
                value: managedList + (roleGroups.managed.length > 10 ? `\n*... and ${roleGroups.managed.length - 10} more*` : ''),
                inline: false
            });
        }

        // Add custom roles
        if (roleGroups.custom.length > 0) {
            const customList = roleGroups.custom.slice(0, 15).map(role => 
                `${role.hexColor} **${role.name}** ${role.mentionable ? '🔔' : '🔕'} (${role.members.size} members)`
            ).join('\n');
            
            embed.addFields({
                name: '🎭 Custom Roles',
                value: customList + (roleGroups.custom.length > 15 ? `\n*... and ${roleGroups.custom.length - 15} more*` : ''),
                inline: false
            });
        }

        // Add everyone role
        if (roleGroups.everyone.length > 0) {
            const everyoneRole = roleGroups.everyone[0];
            embed.addFields({
                name: '👥 Everyone Role',
                value: `${everyoneRole.hexColor} **${everyoneRole.name}** ${everyoneRole.mentionable ? '🔔' : '🔕'} (${everyoneRole.members.size} members)`,
                inline: false
            });
        }

        return embed;
    }
}

// Export the embed manager instance
module.exports = new EmbedManager();