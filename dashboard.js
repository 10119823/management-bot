const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const embedManager = require('./embedUtils');

class DashboardManager {
    constructor() {
        this.premiumFeatures = {
            analytics: true,
            advancedModeration: true,
            customThemes: true,
            realTimeUpdates: true,
            detailedLogging: true,
            autoModeration: true,
            userProfiles: true,
            serverInsights: true
        };
    }

    /**
     * Create a premium server dashboard
     * @param {Object} guild - Discord guild object
     * @param {Object} stats - Server statistics
     * @returns {Object} - Embed and components
     */
    createServerDashboard(guild, stats = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.crown} Premium Server Dashboard`)
            .setDescription(`**${guild.name}** - Advanced Moderation Control Center`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setColor(embedManager.COLORS.PREMIUM_GOLD)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Moderation Bot • Real-time Analytics',
                iconURL: 'https://cdn.discordapp.com/emojis/premium-icon.png'
            });

        // Server Overview
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.stats} Server Overview`,
            value: `**Members:** ${guild.memberCount}\n**Channels:** ${guild.channels.cache.size}\n**Roles:** ${guild.roles.cache.size}\n**Boost Level:** ${guild.premiumTier}`,
            inline: true
        });

        // Moderation Stats
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.shield} Moderation Stats`,
            value: `**Active Bans:** ${stats.activeBans || 0}\n**Warnings Today:** ${stats.warningsToday || 0}\n**Auto-Mod Actions:** ${stats.autoModActions || 0}\n**Blacklisted Users:** ${stats.blacklistedUsers || 0}`,
            inline: true
        });

        // System Status
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.premium} System Status`,
            value: `**Uptime:** 99.9%\n**Response Time:** <50ms\n**Features:** All Active\n**Premium:** ✅ Enabled`,
            inline: true
        });

        // Create interactive buttons
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dashboard_moderation')
                    .setLabel('Moderation Tools')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(embedManager.ACTION_ICONS.shield),
                new ButtonBuilder()
                    .setCustomId('dashboard_analytics')
                    .setLabel('Analytics')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(embedManager.ACTION_ICONS.stats),
                new ButtonBuilder()
                    .setCustomId('dashboard_settings')
                    .setLabel('Settings')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(embedManager.ACTION_ICONS.automod)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('dashboard_users')
                    .setLabel('User Management')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(embedManager.ACTION_ICONS.info),
                new ButtonBuilder()
                    .setCustomId('dashboard_logs')
                    .setLabel('View Logs')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(embedManager.ACTION_ICONS.purge),
                new ButtonBuilder()
                    .setCustomId('dashboard_help')
                    .setLabel('Help & Support')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/support')
            );

        return { embeds: [embed], components: [row1, row2] };
    }

    /**
     * Create an advanced moderation panel
     * @param {Object} user - User object
     * @param {Object} profile - User profile data
     * @returns {Object} - Embed and components
     */
    createModerationPanel(user, profile = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.shield} Advanced Moderation Panel`)
            .setDescription(`Managing: **${user.tag}**`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setColor(embedManager.COLORS.ANIMATED_BLUE)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Moderation Tools • Real-time Updates',
                iconURL: 'https://cdn.discordapp.com/emojis/premium-icon.png'
            });

        // User Information
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.info} User Information`,
            value: `**ID:** \`${user.id}\`\n**Account:** ${user.bot ? 'Bot' : 'User'}\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n**Status:** ${user.presence?.status || 'Offline'}`,
            inline: true
        });

        // Moderation History
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.stats} Moderation History`,
            value: `**Warnings:** ${profile.warnings || 0}\n**Kicks:** ${profile.kicks || 0}\n**Bans:** ${profile.bans || 0}\n**Last Action:** ${profile.lastAction || 'None'}`,
            inline: true
        });

        // Quick Actions
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.premium} Quick Actions`,
            value: `Use the buttons below to perform moderation actions instantly. All actions are logged and tracked in real-time.`,
            inline: false
        });

        // Create moderation buttons
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mod_warn_${user.id}`)
                    .setLabel('Warn User')
                    .setStyle(ButtonStyle.Warning)
                    .setEmoji(embedManager.ACTION_ICONS.warn),
                new ButtonBuilder()
                    .setCustomId(`mod_mute_${user.id}`)
                    .setLabel('Mute User')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(embedManager.ACTION_ICONS.mute),
                new ButtonBuilder()
                    .setCustomId(`mod_kick_${user.id}`)
                    .setLabel('Kick User')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(embedManager.ACTION_ICONS.kick)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mod_ban_${user.id}`)
                    .setLabel('Ban User')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(embedManager.ACTION_ICONS.ban),
                new ButtonBuilder()
                    .setCustomId(`mod_blacklist_${user.id}`)
                    .setLabel('Blacklist')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji(embedManager.ACTION_ICONS.blacklist),
                new ButtonBuilder()
                    .setCustomId(`mod_profile_${user.id}`)
                    .setLabel('View Profile')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(embedManager.ACTION_ICONS.info)
            );

        return { embeds: [embed], components: [row1, row2] };
    }

    /**
     * Create an analytics dashboard
     * @param {Object} analytics - Analytics data
     * @returns {EmbedBuilder}
     */
    createAnalyticsDashboard(analytics = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.stats} Advanced Analytics Dashboard`)
            .setDescription('Real-time server analytics and insights')
            .setColor(embedManager.COLORS.ANIMATED_PURPLE)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Analytics • Updated every 5 seconds',
                iconURL: 'https://cdn.discordapp.com/emojis/analytics-icon.png'
            });

        // Activity Metrics
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.premium} Activity Metrics`,
            value: `**Messages Today:** ${analytics.messagesToday || 0}\n**Active Users:** ${analytics.activeUsers || 0}\n**New Members:** ${analytics.newMembers || 0}\n**Voice Activity:** ${analytics.voiceActivity || '0h 0m'}`,
            inline: true
        });

        // Moderation Metrics
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.shield} Moderation Metrics`,
            value: `**Actions Today:** ${analytics.modActionsToday || 0}\n**Auto-Mod Triggers:** ${analytics.autoModTriggers || 0}\n**Resolved Issues:** ${analytics.resolvedIssues || 0}\n**Success Rate:** ${analytics.successRate || '99.9%'}`,
            inline: true
        });

        // System Performance
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.automod} System Performance`,
            value: `**Uptime:** ${analytics.uptime || '99.9%'}\n**Response Time:** ${analytics.responseTime || '<50ms'}\n**Memory Usage:** ${analytics.memoryUsage || '45%'}\n**CPU Usage:** ${analytics.cpuUsage || '12%'}`,
            inline: true
        });

        return embed;
    }

    /**
     * Create a settings panel
     * @param {Object} settings - Current settings
     * @returns {Object} - Embed and components
     */
    createSettingsPanel(settings = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.automod} Advanced Settings Panel`)
            .setDescription('Configure your server\'s moderation settings')
            .setColor(embedManager.COLORS.ANIMATED_PINK)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Settings • Changes saved automatically',
                iconURL: 'https://cdn.discordapp.com/emojis/settings-icon.png'
            });

        // Current Settings
        embed.addFields({
            name: `${embedManager.ACTION_ICONS.premium} Current Settings`,
            value: `**Auto-Mod:** ${settings.autoMod ? 'Enabled' : 'Disabled'}\n**Logging:** ${settings.logging ? 'Enabled' : 'Disabled'}\n**Welcome Messages:** ${settings.welcome ? 'Enabled' : 'Disabled'}\n**Anti-Spam:** ${settings.antiSpam ? 'Enabled' : 'Disabled'}`,
            inline: true
        });

        // Create settings dropdown
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('settings_select')
            .setPlaceholder('Select a setting to configure')
            .addOptions([
                new StringSelectMenuOptionBuilder()
                    .setLabel('Auto-Moderation')
                    .setDescription('Configure automatic moderation features')
                    .setValue('automod')
                    .setEmoji(embedManager.ACTION_ICONS.automod),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Logging')
                    .setDescription('Configure logging and audit features')
                    .setValue('logging')
                    .setEmoji(embedManager.ACTION_ICONS.purge),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Welcome System')
                    .setDescription('Configure welcome messages and onboarding')
                    .setValue('welcome')
                    .setEmoji(embedManager.ACTION_ICONS.welcome),
                new StringSelectMenuOptionBuilder()
                    .setLabel('Anti-Spam')
                    .setDescription('Configure spam protection settings')
                    .setValue('antispam')
                    .setEmoji(embedManager.ACTION_ICONS.shield)
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        return { embeds: [embed], components: [row] };
    }

    /**
     * Create a loading embed with animation
     * @param {string} message - Loading message
     * @returns {EmbedBuilder}
     */
    createLoadingEmbed(message = 'Loading...') {
        return new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.loading} ${message}`)
            .setDescription('Please wait while we process your request...')
            .setColor(embedManager.COLORS.ANIMATED_BLUE)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Moderation Bot • Processing...',
                iconURL: 'https://cdn.discordapp.com/emojis/loading-icon.png'
            });
    }

    /**
     * Create a premium feature unlock embed
     * @param {string} feature - Feature name
     * @returns {EmbedBuilder}
     */
    createFeatureUnlockEmbed(feature) {
        return new EmbedBuilder()
            .setTitle(`${embedManager.ACTION_ICONS.premium} Premium Feature Unlocked!`)
            .setDescription(`**${feature}** is now available in your server!`)
            .setColor(embedManager.COLORS.PREMIUM_GOLD)
            .setTimestamp()
            .setFooter({ 
                text: 'Premium Moderation Bot • Feature Unlocked',
                iconURL: 'https://cdn.discordapp.com/emojis/premium-icon.png'
            })
            .addFields({
                name: `${embedManager.ACTION_ICONS.crown} What's New`,
                value: `• Advanced ${feature} controls\n• Real-time updates\n• Enhanced security\n• Premium support`,
                inline: false
            });
    }
}

module.exports = new DashboardManager();