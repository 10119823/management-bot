const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, REST, Routes, Collection, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const chalk = require('chalk');
const embedManager = require('./embedUtils');
const dashboard = require('./dashboard');
const logger = require('./logger');
const autoMod = require('./autoMod');
require('dotenv').config();

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildModeration
    ]
});

// Database setup
const db = new sqlite3.Database('./bot_database.sqlite');

// Initialize database tables
db.serialize(() => {
    // Blacklist table
    db.run(`CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        reason TEXT,
        moderator_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Moderation logs table
    db.run(`CREATE TABLE IF NOT EXISTS moderation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // User profiles table
    db.run(`CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        warnings INTEGER DEFAULT 0,
        kicks INTEGER DEFAULT 0,
        bans INTEGER DEFAULT 0,
        join_date DATETIME,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Auto-moderation settings
    db.run(`CREATE TABLE IF NOT EXISTS automod_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_name TEXT UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1
    )`);

    // Insert default auto-moderation settings
    db.run(`INSERT OR IGNORE INTO automod_settings (setting_name, setting_value) VALUES 
        ('spam_threshold', '5'),
        ('spam_timeframe', '10'),
        ('max_warnings', '3'),
        ('auto_ban_threshold', '5')
    `);
});

// Command collection
client.commands = new Collection();

// Utility functions
const hasPermission = (member, requiredRole) => {
    return member.roles.cache.has(process.env.MODERATOR_ROLE_ID) || 
           member.roles.cache.has(process.env.ADMIN_ROLE_ID) ||
           member.permissions.has(PermissionFlagsBits.Administrator);
};

const logAction = (action, userId, moderatorId, reason = null) => {
    db.run(
        'INSERT INTO moderation_logs (action, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
        [action, userId, moderatorId, reason]
    );
};

const updateUserProfile = (userId, field) => {
    db.run(
        `INSERT OR REPLACE INTO user_profiles (user_id, ${field}, last_seen) 
         VALUES (?, COALESCE((SELECT ${field} FROM user_profiles WHERE user_id = ?), 0) + 1, CURRENT_TIMESTAMP)`,
        [userId, userId]
    );
};

const sendLogEmbed = async (action, user, moderator, reason = null, additionalInfo = {}) => {
    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (!logChannel) return;

    const embed = embedManager.createModerationEmbed(action, user, moderator, reason, additionalInfo);
    await logChannel.send({ embeds: [embed] });
};

// Slash Commands
const commands = [
    // Ban command
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_messages')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // Kick command
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    // Unban command
    new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('The user ID to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // Blacklist command
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Add a user to the blacklist')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to blacklist')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for blacklisting')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    // Unblacklist command
    new SlashCommandBuilder()
        .setName('unblacklist')
        .setDescription('Remove a user from the blacklist')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unblacklist')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    // View user command
    new SlashCommandBuilder()
        .setName('viewuser')
        .setDescription('View detailed information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    // Advanced commands
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user (timeout)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080)) // Max 7 days
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmute a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to unmute')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete multiple messages')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure auto-moderation settings')
        .addStringOption(option =>
            option.setName('setting')
                .setDescription('Setting to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'Spam Threshold', value: 'spam_threshold' },
                    { name: 'Max Warnings', value: 'max_warnings' },
                    { name: 'Auto Ban Threshold', value: 'auto_ban_threshold' }
                ))
        .addStringOption(option =>
            option.setName('value')
                .setDescription('New value for the setting')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View server statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Open the premium server dashboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure auto-moderation settings')
        .addStringOption(option =>
            option.setName('setting')
                .setDescription('Setting to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'Spam Protection', value: 'spam' },
                    { name: 'Profanity Filter', value: 'profanity' },
                    { name: 'Caps Filter', value: 'caps' },
                    { name: 'Link Filter', value: 'links' },
                    { name: 'Mention Filter', value: 'mentions' },
                    { name: 'Invite Filter', value: 'invites' }
                ))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to take')
                .setRequired(true)
                .addChoices(
                    { name: 'Delete', value: 'delete' },
                    { name: 'Warn', value: 'warn' },
                    { name: 'Delete & Warn', value: 'delete_and_warn' },
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Kick', value: 'kick' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(chalk.blue('Started refreshing application (/) commands.'));
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log(chalk.green('Successfully reloaded application (/) commands.'));
    } catch (error) {
        console.error(chalk.red('Error refreshing commands:'), error);
    }
})();

// Event handlers
client.once(Events.ClientReady, () => {
    console.log(chalk.green(`✅ Bot is online! Logged in as ${client.user.tag}`));
    client.user.setActivity('Managing the community', { type: 'WATCHING' });
});

client.on(Events.GuildMemberAdd, async (member) => {
    // Welcome new members
    const welcomeChannel = client.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
    if (welcomeChannel) {
        const embed = embedManager.createWelcomeEmbed(member);
        await welcomeChannel.send({ embeds: [embed] });
    }

    // Check if user is blacklisted
    db.get('SELECT * FROM blacklist WHERE user_id = ?', [member.id], (err, row) => {
        if (row) {
            member.kick('User is blacklisted');
            sendLogEmbed('Auto-kick (Blacklisted)', member.user, client.user, 'User was on blacklist');
        }
    });

    // Add to user profiles
    db.run('INSERT OR IGNORE INTO user_profiles (user_id, join_date) VALUES (?, CURRENT_TIMESTAMP)', [member.id]);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Update last seen
    db.run('UPDATE user_profiles SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?', [message.author.id]);

    // Advanced auto-moderation
    if (message.guild) {
        try {
            const actionTaken = await autoMod.processMessage(message);
            
            // Log message activity
            logger.createLogEntry('INFO', 'Message processed', {
                user: message.author,
                action: 'message_sent',
                server: message.guild.name,
                details: `Channel: #${message.channel.name}`
            });

            if (actionTaken) {
                logger.createLogEntry('WARN', 'Auto-moderation action taken', {
                    user: message.author,
                    action: 'auto_moderation',
                    server: message.guild.name,
                    details: 'Message flagged and action taken'
                });
            }
        } catch (error) {
            console.error('Auto-moderation error:', error);
            logger.createLogEntry('ERROR', 'Auto-moderation failed', {
                user: message.author,
                action: 'auto_moderation_error',
                server: message.guild.name,
                details: error.message
            });
        }
    }
});

// Command handlers
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'ban':
                await handleBan(interaction);
                break;
            case 'kick':
                await handleKick(interaction);
                break;
            case 'unban':
                await handleUnban(interaction);
                break;
            case 'blacklist':
                await handleBlacklist(interaction);
                break;
            case 'unblacklist':
                await handleUnblacklist(interaction);
                break;
            case 'viewuser':
                await handleViewUser(interaction);
                break;
            case 'warn':
                await handleWarn(interaction);
                break;
            case 'mute':
                await handleMute(interaction);
                break;
            case 'unmute':
                await handleUnmute(interaction);
                break;
            case 'purge':
                await handlePurge(interaction);
                break;
            case 'automod':
                await handleAutomod(interaction);
                break;
            case 'stats':
                await handleStats(interaction);
                break;
            case 'dashboard':
                await handleDashboard(interaction);
                break;
            case 'automod_settings':
                await handleAutoModSettings(interaction);
                break;
        }
    } catch (error) {
        console.error(chalk.red('Error handling command:'), error);
        const embed = embedManager.createErrorEmbed(
            'Command Error',
            'There was an error executing this command. Please try again later.',
            commandName
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

// Command implementations
async function handleBan(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createErrorEmbed(
            'Permission Denied',
            'You do not have permission to use this command.',
            'ban'
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteMessages = interaction.options.getInteger('delete_messages') || 0;

    if (user.id === interaction.user.id) {
        return interaction.reply({ content: 'You cannot ban yourself!', ephemeral: true });
    }

    try {
        await interaction.guild.members.ban(user, { 
            reason: reason,
            deleteMessageDays: deleteMessages
        });
        
        updateUserProfile(user.id, 'bans');
        logAction('ban', user.id, interaction.user.id, reason);
        await sendLogEmbed('Ban', user, interaction.user, reason, { duration: 'Permanent' });

        const embed = embedManager.createSuccessEmbed(
            'User Banned',
            `Successfully banned **${user.tag}**`,
            { reason: reason !== 'No reason provided' ? reason : null }
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        const embed = embedManager.createErrorEmbed(
            'Ban Failed',
            'Failed to ban user. They might have a higher role than me or there was an error.',
            'ban'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleKick(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createErrorEmbed(
            'Permission Denied',
            'You do not have permission to use this command.',
            'kick'
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id) {
        return interaction.reply({ content: 'You cannot kick yourself!', ephemeral: true });
    }

    try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.kick(reason);
        
        updateUserProfile(user.id, 'kicks');
        logAction('kick', user.id, interaction.user.id, reason);
        await sendLogEmbed('Kick', user, interaction.user, reason);

        const embed = embedManager.createSuccessEmbed(
            'User Kicked',
            `Successfully kicked **${user.tag}**`,
            { reason: reason !== 'No reason provided' ? reason : null }
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        const embed = embedManager.createErrorEmbed(
            'Kick Failed',
            'Failed to kick user. They might have a higher role than me or there was an error.',
            'kick'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleUnban(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createPermissionDeniedEmbed('unban');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
        await interaction.guild.members.unban(userId, reason);
        logAction('unban', userId, interaction.user.id, reason);
        await sendLogEmbed('Unban', { id: userId, tag: `User ID: ${userId}` }, interaction.user, reason);

        const embed = embedManager.createSuccessEmbed(
            'User Unbanned',
            `Successfully unbanned user **${userId}**`,
            { reason: reason !== 'No reason provided' ? reason : null }
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        const embed = embedManager.createErrorEmbed(
            'Unban Failed',
            'Failed to unban user. They might not be banned or there was an error.',
            'unban'
        );
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

async function handleBlacklist(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createPermissionDeniedEmbed('blacklist');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    db.run(
        'INSERT OR REPLACE INTO blacklist (user_id, reason, moderator_id) VALUES (?, ?, ?)',
        [user.id, reason, interaction.user.id],
        function(err) {
            if (err) {
                const embed = embedManager.createErrorEmbed(
                    'Blacklist Failed',
                    'Failed to blacklist user. There was an error.',
                    'blacklist'
                );
                interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                logAction('blacklist', user.id, interaction.user.id, reason);
                sendLogEmbed('Blacklist', user, interaction.user, reason);
                const embed = embedManager.createSuccessEmbed(
                    'User Blacklisted',
                    `Successfully blacklisted **${user.tag}**`,
                    { reason: reason !== 'No reason provided' ? reason : null }
                );
                interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    );
}

async function handleUnblacklist(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createPermissionDeniedEmbed('unblacklist');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = interaction.options.getUser('user');

    db.run('DELETE FROM blacklist WHERE user_id = ?', [user.id], function(err) {
        if (err) {
            const embed = embedManager.createErrorEmbed(
                'Unblacklist Failed',
                'Failed to unblacklist user. There was an error.',
                'unblacklist'
            );
            interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (this.changes === 0) {
            const embed = embedManager.createErrorEmbed(
                'User Not Blacklisted',
                'This user is not currently blacklisted.',
                'unblacklist'
            );
            interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            logAction('unblacklist', user.id, interaction.user.id);
            sendLogEmbed('Unblacklist', user, interaction.user);
            const embed = embedManager.createSuccessEmbed(
                'User Unblacklisted',
                `Successfully unblacklisted **${user.tag}**`
            );
            interaction.reply({ embeds: [embed], ephemeral: true });
        }
    });
}

async function handleViewUser(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createPermissionDeniedEmbed('viewuser');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    
    db.get('SELECT * FROM user_profiles WHERE user_id = ?', [user.id], (err, profile) => {
        if (err) {
            return interaction.reply({ content: 'Error fetching user data.', ephemeral: true });
        }

        const embed = embedManager.createUserInfoEmbed(user, profile);
        interaction.reply({ embeds: [embed], ephemeral: true });
    });
}

async function handleWarn(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    updateUserProfile(user.id, 'warnings');
    logAction('warn', user.id, interaction.user.id, reason);
    await sendLogEmbed('Warning', user, interaction.user, reason);

    await interaction.reply({ 
        content: `✅ Successfully warned ${user.tag} for: ${reason}`,
        ephemeral: true 
    });
}

async function handleMute(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(duration * 60 * 1000, reason);
        
        logAction('mute', user.id, interaction.user.id, reason);
        await sendLogEmbed('Mute', user, interaction.user, reason, { duration: `${duration} minutes` });

        await interaction.reply({ 
            content: `✅ Successfully muted ${user.tag} for ${duration} minutes${reason !== 'No reason provided' ? ` for: ${reason}` : ''}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to mute user.', ephemeral: true });
    }
}

async function handleUnmute(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');

    try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(null);
        
        logAction('unmute', user.id, interaction.user.id);
        await sendLogEmbed('Unmute', user, interaction.user);

        await interaction.reply({ 
            content: `✅ Successfully unmuted ${user.tag}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to unmute user.', ephemeral: true });
    }
}

async function handlePurge(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');

    try {
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        let messagesToDelete = messages;

        if (user) {
            messagesToDelete = messages.filter(msg => msg.author.id === user.id);
        }

        await interaction.channel.bulkDelete(messagesToDelete);
        
        logAction('purge', 'multiple', interaction.user.id, `Deleted ${messagesToDelete.size} messages`);
        await sendLogEmbed('Purge', { tag: `${messagesToDelete.size} messages` }, interaction.user, `Deleted ${messagesToDelete.size} messages`);

        await interaction.reply({ 
            content: `✅ Successfully deleted ${messagesToDelete.size} messages`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to delete messages.', ephemeral: true });
    }
}

async function handleAutomod(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'You need administrator permissions to use this command!', ephemeral: true });
    }

    const setting = interaction.options.getString('setting');
    const value = interaction.options.getString('value');

    db.run(
        'UPDATE automod_settings SET setting_value = ? WHERE setting_name = ?',
        [value, setting],
        function(err) {
            if (err) {
                interaction.reply({ content: 'Failed to update setting.', ephemeral: true });
            } else if (this.changes === 0) {
                interaction.reply({ content: 'Setting not found.', ephemeral: true });
            } else {
                interaction.reply({ 
                    content: `✅ Successfully updated ${setting} to ${value}`,
                    ephemeral: true 
                });
            }
        }
    );
}

async function handleStats(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const guild = interaction.guild;
    
    const embed = embedManager.createStatsEmbed(guild);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDashboard(interaction) {
    if (!hasPermission(interaction.member)) {
        const embed = embedManager.createPermissionDeniedEmbed('dashboard');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Get server statistics
    const guild = interaction.guild;
    const stats = {
        activeBans: guild.bans.cache.size,
        warningsToday: 0, // This would be calculated from database
        autoModActions: autoMod.userViolations.size,
        blacklistedUsers: 0 // This would be calculated from database
    };

    const dashboardData = dashboard.createServerDashboard(guild, stats);
    await interaction.reply(dashboardData);
}

async function handleAutoModSettings(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = embedManager.createErrorEmbed(
            'Permission Denied',
            'You need administrator permissions to configure auto-moderation.',
            'automod_settings'
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const setting = interaction.options.getString('setting');
    const action = interaction.options.getString('action');

    // Update auto-moderation rule
    autoMod.updateRule(setting, { action });

    const embed = embedManager.createSuccessEmbed(
        'Auto-Moderation Updated',
        `Successfully updated ${setting} to use ${action} action`,
        { setting, action }
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Login
client.login(process.env.DISCORD_TOKEN);