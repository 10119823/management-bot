const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, REST, Routes, Collection, Events } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const moment = require('moment');
const chalk = require('chalk');
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

    // Server settings
    db.run(`CREATE TABLE IF NOT EXISTS server_settings (
        guild_id TEXT PRIMARY KEY,
        prefix TEXT DEFAULT '!',
        welcome_channel_id TEXT,
        leave_channel_id TEXT,
        log_channel_id TEXT,
        mod_role_id TEXT,
        admin_role_id TEXT,
        mute_role_id TEXT,
        auto_role_id TEXT,
        welcome_message TEXT DEFAULT 'Welcome {user} to {server}!',
        leave_message TEXT DEFAULT '{user} has left {server}.',
        leveling_enabled BOOLEAN DEFAULT 0,
        economy_enabled BOOLEAN DEFAULT 0,
        ticket_category_id TEXT,
        reaction_role_message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tickets system
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        closed_by TEXT
    )`);

    // Reaction roles
    db.run(`CREATE TABLE IF NOT EXISTS reaction_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        role_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // User levels and XP
    db.run(`CREATE TABLE IF NOT EXISTS user_levels (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        last_message DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, guild_id)
    )`);

    // Economy system
    db.run(`CREATE TABLE IF NOT EXISTS user_economy (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        balance INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        last_daily DATETIME,
        last_work DATETIME,
        PRIMARY KEY (user_id, guild_id)
    )`);

    // Polls
    db.run(`CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Poll votes
    db.run(`CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        option_index INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (poll_id, user_id),
        FOREIGN KEY (poll_id) REFERENCES polls (id)
    )`);

    // Word filter
    db.run(`CREATE TABLE IF NOT EXISTS word_filter (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        word TEXT NOT NULL,
        action TEXT DEFAULT 'delete',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default auto-moderation settings
    db.run(`INSERT OR IGNORE INTO automod_settings (setting_name, setting_value) VALUES 
        ('spam_threshold', '5'),
        ('spam_timeframe', '10'),
        ('max_warnings', '3'),
        ('auto_ban_threshold', '5'),
        ('caps_threshold', '70'),
        ('mention_threshold', '5'),
        ('link_protection', '1'),
        ('word_filter_enabled', '1')
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

    const embed = new EmbedBuilder()
        .setTitle(`🔨 ${action}`)
        .setColor(action.includes('ban') ? '#ff0000' : action.includes('kick') ? '#ffaa00' : '#00ff00')
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Moderator', value: `${moderator.tag}`, inline: true },
            { name: 'Reason', value: reason || 'No reason provided', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Moderation Bot` });

    if (additionalInfo.duration) {
        embed.addFields({ name: 'Duration', value: additionalInfo.duration, inline: true });
    }

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

    // Role Management Commands
    new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Add a role to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add the role to')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to add')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Remove a role from a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove the role from')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('createrole')
        .setDescription('Create a new role')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the role')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Color of the role (hex code)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('mentionable')
                .setDescription('Whether the role is mentionable')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('hoisted')
                .setDescription('Whether the role is displayed separately')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('deleterole')
        .setDescription('Delete a role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to delete')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Get information about a role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to get information about')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    new SlashCommandBuilder()
        .setName('massrole')
        .setDescription('Add or remove a role from multiple users')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to manage')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add Role', value: 'add' },
                    { name: 'Remove Role', value: 'remove' }
                ))
        .addStringOption(option =>
            option.setName('users')
                .setDescription('User IDs separated by spaces')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    // Channel Management Commands
    new SlashCommandBuilder()
        .setName('createchannel')
        .setDescription('Create a new channel')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the channel')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of channel')
                .setRequired(true)
                .addChoices(
                    { name: 'Text Channel', value: 'text' },
                    { name: 'Voice Channel', value: 'voice' },
                    { name: 'Category', value: 'category' }
                ))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Category to put the channel in')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('deletechannel')
        .setDescription('Delete a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to delete')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('lockchannel')
        .setDescription('Lock a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to lock')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('unlockchannel')
        .setDescription('Unlock a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to unlock')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for a channel')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode in seconds (0-21600)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to set slowmode for')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName('channelinfo')
        .setDescription('Get information about a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to get information about')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    // Utility Commands
    new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get a user\'s avatar')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to get avatar for')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Get detailed user information')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to get information for')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Get bot information')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Check bot uptime')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    // Fun Commands
    new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8-ball a question')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Your question')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll dice')
        .addIntegerOption(option =>
            option.setName('sides')
                .setDescription('Number of sides (default 6)')
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(100))
        .addIntegerOption(option =>
            option.setName('count')
                .setDescription('Number of dice (default 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    // Server Configuration Commands
    new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('Set the bot prefix for this server')
        .addStringOption(option =>
            option.setName('prefix')
                .setDescription('New prefix (max 5 characters)')
                .setRequired(true)
                .setMaxLength(5))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('setwelcome')
        .setDescription('Set welcome channel and message')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Welcome channel')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Welcome message (use {user} for user mention, {server} for server name)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('setleave')
        .setDescription('Set leave channel and message')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Leave channel')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Leave message (use {user} for user mention, {server} for server name)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('setlogchannel')
        .setDescription('Set the moderation log channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Log channel')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get detailed server information')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
        .setName('servericon')
        .setDescription('Get the server icon')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
        const embed = new EmbedBuilder()
            .setTitle('🎉 Welcome!')
            .setDescription(`Welcome to the server, ${member.user}!`)
            .setColor('#00ff00')
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

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

    // Auto-moderation for spam
    const spamThreshold = 5;
    const spamTimeframe = 10000; // 10 seconds

    if (message.guild) {
        const userMessages = message.channel.messages.cache
            .filter(m => m.author.id === message.author.id && Date.now() - m.createdTimestamp < spamTimeframe)
            .size();

        if (userMessages >= spamThreshold) {
            await message.delete();
            const warning = await message.channel.send(`${message.author}, please don't spam!`);
            setTimeout(() => warning.delete(), 5000);
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
            case 'addrole':
                await handleAddRole(interaction);
                break;
            case 'removerole':
                await handleRemoveRole(interaction);
                break;
            case 'createrole':
                await handleCreateRole(interaction);
                break;
            case 'deleterole':
                await handleDeleteRole(interaction);
                break;
            case 'roleinfo':
                await handleRoleInfo(interaction);
                break;
            case 'massrole':
                await handleMassRole(interaction);
                break;
            case 'createchannel':
                await handleCreateChannel(interaction);
                break;
            case 'deletechannel':
                await handleDeleteChannel(interaction);
                break;
            case 'lockchannel':
                await handleLockChannel(interaction);
                break;
            case 'unlockchannel':
                await handleUnlockChannel(interaction);
                break;
            case 'slowmode':
                await handleSlowmode(interaction);
                break;
            case 'channelinfo':
                await handleChannelInfo(interaction);
                break;
            case 'avatar':
                await handleAvatar(interaction);
                break;
            case 'userinfo':
                await handleUserInfo(interaction);
                break;
            case 'botinfo':
                await handleBotInfo(interaction);
                break;
            case 'ping':
                await handlePing(interaction);
                break;
            case 'uptime':
                await handleUptime(interaction);
                break;
            case '8ball':
                await handle8Ball(interaction);
                break;
            case 'dice':
                await handleDice(interaction);
                break;
            case 'coinflip':
                await handleCoinFlip(interaction);
                break;
            case 'joke':
                await handleJoke(interaction);
                break;
            case 'meme':
                await handleMeme(interaction);
                break;
            case 'setprefix':
                await handleSetPrefix(interaction);
                break;
            case 'setwelcome':
                await handleSetWelcome(interaction);
                break;
            case 'setleave':
                await handleSetLeave(interaction);
                break;
            case 'setlogchannel':
                await handleSetLogChannel(interaction);
                break;
            case 'serverinfo':
                await handleServerInfo(interaction);
                break;
            case 'servericon':
                await handleServerIcon(interaction);
                break;
        }
    } catch (error) {
        console.error(chalk.red('Error handling command:'), error);
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
});

// Command implementations
async function handleBan(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
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

        await interaction.reply({ 
            content: `✅ Successfully banned ${user.tag}${reason !== 'No reason provided' ? ` for: ${reason}` : ''}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to ban user. They might have a higher role than me.', ephemeral: true });
    }
}

async function handleKick(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
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

        await interaction.reply({ 
            content: `✅ Successfully kicked ${user.tag}${reason !== 'No reason provided' ? ` for: ${reason}` : ''}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to kick user. They might have a higher role than me.', ephemeral: true });
    }
}

async function handleUnban(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
        await interaction.guild.members.unban(userId, reason);
        logAction('unban', userId, interaction.user.id, reason);
        await sendLogEmbed('Unban', { id: userId, tag: `User ID: ${userId}` }, interaction.user, reason);

        await interaction.reply({ 
            content: `✅ Successfully unbanned user ${userId}${reason !== 'No reason provided' ? ` for: ${reason}` : ''}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to unban user. They might not be banned.', ephemeral: true });
    }
}

async function handleBlacklist(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    db.run(
        'INSERT OR REPLACE INTO blacklist (user_id, reason, moderator_id) VALUES (?, ?, ?)',
        [user.id, reason, interaction.user.id],
        function(err) {
            if (err) {
                interaction.reply({ content: 'Failed to blacklist user.', ephemeral: true });
            } else {
                logAction('blacklist', user.id, interaction.user.id, reason);
                sendLogEmbed('Blacklist', user, interaction.user, reason);
                interaction.reply({ 
                    content: `✅ Successfully blacklisted ${user.tag}${reason !== 'No reason provided' ? ` for: ${reason}` : ''}`,
                    ephemeral: true 
                });
            }
        }
    );
}

async function handleUnblacklist(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');

    db.run('DELETE FROM blacklist WHERE user_id = ?', [user.id], function(err) {
        if (err) {
            interaction.reply({ content: 'Failed to unblacklist user.', ephemeral: true });
        } else if (this.changes === 0) {
            interaction.reply({ content: 'User is not blacklisted.', ephemeral: true });
        } else {
            logAction('unblacklist', user.id, interaction.user.id);
            sendLogEmbed('Unblacklist', user, interaction.user);
            interaction.reply({ 
                content: `✅ Successfully unblacklisted ${user.tag}`,
                ephemeral: true 
            });
        }
    });
}

async function handleViewUser(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    
    db.get('SELECT * FROM user_profiles WHERE user_id = ?', [user.id], (err, profile) => {
        if (err) {
            return interaction.reply({ content: 'Error fetching user data.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`👤 User Information: ${user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .setColor('#0099ff')
            .addFields(
                { name: 'User ID', value: user.id, inline: true },
                { name: 'Account Created', value: moment(user.createdAt).format('YYYY-MM-DD HH:mm:ss'), inline: true },
                { name: 'Warnings', value: (profile?.warnings || 0).toString(), inline: true },
                { name: 'Kicks', value: (profile?.kicks || 0).toString(), inline: true },
                { name: 'Bans', value: (profile?.bans || 0).toString(), inline: true },
                { name: 'Join Date', value: profile?.join_date ? moment(profile.join_date).format('YYYY-MM-DD HH:mm:ss') : 'Unknown', inline: true },
                { name: 'Last Seen', value: profile?.last_seen ? moment(profile.last_seen).format('YYYY-MM-DD HH:mm:ss') : 'Unknown', inline: true }
            )
            .setTimestamp();

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
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Server Statistics')
        .setColor('#0099ff')
        .addFields(
            { name: 'Total Members', value: guild.memberCount.toString(), inline: true },
            { name: 'Online Members', value: guild.members.cache.filter(member => member.presence?.status === 'online').size.toString(), inline: true },
            { name: 'Text Channels', value: guild.channels.cache.filter(channel => channel.type === 0).size.toString(), inline: true },
            { name: 'Voice Channels', value: guild.channels.cache.filter(channel => channel.type === 2).size.toString(), inline: true },
            { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
            { name: 'Server Created', value: moment(guild.createdAt).format('YYYY-MM-DD'), inline: true }
        )
        .setThumbnail(guild.iconURL())
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Role Management Functions
async function handleAddRole(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.add(role);
        
        logAction('addrole', user.id, interaction.user.id, `Added role: ${role.name}`);
        await sendLogEmbed('Role Added', user, interaction.user, `Added role: ${role.name}`);

        await interaction.reply({ 
            content: `✅ Successfully added ${role.name} to ${user.tag}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to add role. Check role hierarchy and permissions.', ephemeral: true });
    }
}

async function handleRemoveRole(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.remove(role);
        
        logAction('removerole', user.id, interaction.user.id, `Removed role: ${role.name}`);
        await sendLogEmbed('Role Removed', user, interaction.user, `Removed role: ${role.name}`);

        await interaction.reply({ 
            content: `✅ Successfully removed ${role.name} from ${user.tag}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to remove role. Check role hierarchy and permissions.', ephemeral: true });
    }
}

async function handleCreateRole(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const color = interaction.options.getString('color') || '#000000';
    const mentionable = interaction.options.getBoolean('mentionable') || false;
    const hoisted = interaction.options.getBoolean('hoisted') || false;

    try {
        const role = await interaction.guild.roles.create({
            name: name,
            color: color,
            mentionable: mentionable,
            hoist: hoisted
        });
        
        logAction('createrole', 'system', interaction.user.id, `Created role: ${role.name}`);
        await sendLogEmbed('Role Created', { tag: role.name, id: role.id }, interaction.user, `Created role: ${role.name}`);

        await interaction.reply({ 
            content: `✅ Successfully created role ${role.name}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to create role. Check permissions.', ephemeral: true });
    }
}

async function handleDeleteRole(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    if (role.id === interaction.guild.roles.everyone.id) {
        return interaction.reply({ content: 'Cannot delete the @everyone role!', ephemeral: true });
    }

    try {
        const roleName = role.name;
        await role.delete();
        
        logAction('deleterole', 'system', interaction.user.id, `Deleted role: ${roleName}`);
        await sendLogEmbed('Role Deleted', { tag: roleName, id: role.id }, interaction.user, `Deleted role: ${roleName}`);

        await interaction.reply({ 
            content: `✅ Successfully deleted role ${roleName}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to delete role. Check permissions and role hierarchy.', ephemeral: true });
    }
}

async function handleRoleInfo(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    const members = role.members.size;

    const embed = new EmbedBuilder()
        .setTitle(`📋 Role Information: ${role.name}`)
        .setColor(role.color || '#0099ff')
        .addFields(
            { name: 'Role ID', value: role.id, inline: true },
            { name: 'Members', value: members.toString(), inline: true },
            { name: 'Color', value: role.hexColor, inline: true },
            { name: 'Position', value: role.position.toString(), inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
            { name: 'Created', value: moment(role.createdAt).format('YYYY-MM-DD HH:mm:ss'), inline: true },
            { name: 'Permissions', value: role.permissions.toArray().length > 0 ? role.permissions.toArray().slice(0, 10).join(', ') : 'None', inline: false }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleMassRole(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    const action = interaction.options.getString('action');
    const userIds = interaction.options.getString('users').split(' ').filter(id => id.trim());

    if (userIds.length === 0) {
        return interaction.reply({ content: 'Please provide at least one user ID.', ephemeral: true });
    }

    if (userIds.length > 50) {
        return interaction.reply({ content: 'Maximum 50 users at once.', ephemeral: true });
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const userId of userIds) {
        try {
            const member = await interaction.guild.members.fetch(userId);
            if (action === 'add') {
                await member.roles.add(role);
            } else {
                await member.roles.remove(role);
            }
            successCount++;
        } catch (error) {
            failCount++;
            errors.push(`${userId}: ${error.message}`);
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`🔄 Mass Role ${action === 'add' ? 'Add' : 'Remove'}`)
        .setColor(successCount > 0 ? '#00ff00' : '#ff0000')
        .addFields(
            { name: 'Role', value: role.name, inline: true },
            { name: 'Action', value: action === 'add' ? 'Add' : 'Remove', inline: true },
            { name: 'Success', value: successCount.toString(), inline: true },
            { name: 'Failed', value: failCount.toString(), inline: true }
        )
        .setTimestamp();

    if (errors.length > 0 && errors.length <= 10) {
        embed.addFields({ name: 'Errors', value: errors.join('\n'), inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Channel Management Functions
async function handleCreateChannel(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const type = interaction.options.getString('type');
    const category = interaction.options.getChannel('category');

    try {
        let channel;
        const options = { name: name };
        
        if (category && category.type === 4) { // Category
            options.parent = category.id;
        }

        switch (type) {
            case 'text':
                channel = await interaction.guild.channels.create(options);
                break;
            case 'voice':
                channel = await interaction.guild.channels.create({
                    ...options,
                    type: 2 // Voice channel
                });
                break;
            case 'category':
                channel = await interaction.guild.channels.create({
                    name: name,
                    type: 4 // Category
                });
                break;
        }
        
        logAction('createchannel', 'system', interaction.user.id, `Created ${type} channel: ${channel.name}`);
        await sendLogEmbed('Channel Created', { tag: channel.name, id: channel.id }, interaction.user, `Created ${type} channel: ${channel.name}`);

        await interaction.reply({ 
            content: `✅ Successfully created ${type} channel ${channel}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to create channel. Check permissions.', ephemeral: true });
    }
}

async function handleDeleteChannel(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');

    try {
        const channelName = channel.name;
        const channelType = channel.type === 0 ? 'text' : channel.type === 2 ? 'voice' : channel.type === 4 ? 'category' : 'unknown';
        await channel.delete();
        
        logAction('deletechannel', 'system', interaction.user.id, `Deleted ${channelType} channel: ${channelName}`);
        await sendLogEmbed('Channel Deleted', { tag: channelName, id: channel.id }, interaction.user, `Deleted ${channelType} channel: ${channelName}`);

        await interaction.reply({ 
            content: `✅ Successfully deleted ${channelType} channel ${channelName}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to delete channel. Check permissions.', ephemeral: true });
    }
}

async function handleLockChannel(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (channel.type !== 0) {
        return interaction.reply({ content: 'Can only lock text channels!', ephemeral: true });
    }

    try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false
        });
        
        logAction('lockchannel', 'system', interaction.user.id, `Locked channel: ${channel.name}`);
        await sendLogEmbed('Channel Locked', { tag: channel.name, id: channel.id }, interaction.user, `Locked channel: ${channel.name}`);

        await interaction.reply({ 
            content: `✅ Successfully locked ${channel}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to lock channel. Check permissions.', ephemeral: true });
    }
}

async function handleUnlockChannel(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (channel.type !== 0) {
        return interaction.reply({ content: 'Can only unlock text channels!', ephemeral: true });
    }

    try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: null
        });
        
        logAction('unlockchannel', 'system', interaction.user.id, `Unlocked channel: ${channel.name}`);
        await sendLogEmbed('Channel Unlocked', { tag: channel.name, id: channel.id }, interaction.user, `Unlocked channel: ${channel.name}`);

        await interaction.reply({ 
            content: `✅ Successfully unlocked ${channel}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to unlock channel. Check permissions.', ephemeral: true });
    }
}

async function handleSlowmode(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (channel.type !== 0) {
        return interaction.reply({ content: 'Can only set slowmode on text channels!', ephemeral: true });
    }

    try {
        await channel.setRateLimitPerUser(seconds);
        
        logAction('slowmode', 'system', interaction.user.id, `Set slowmode to ${seconds}s in: ${channel.name}`);
        await sendLogEmbed('Slowmode Set', { tag: channel.name, id: channel.id }, interaction.user, `Set slowmode to ${seconds} seconds in: ${channel.name}`);

        await interaction.reply({ 
            content: `✅ Successfully set slowmode to ${seconds} seconds in ${channel}`,
            ephemeral: true 
        });
    } catch (error) {
        await interaction.reply({ content: 'Failed to set slowmode. Check permissions.', ephemeral: true });
    }
}

async function handleChannelInfo(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const typeNames = {
        0: 'Text Channel',
        2: 'Voice Channel',
        4: 'Category',
        5: 'Announcement Channel',
        10: 'News Thread',
        11: 'Public Thread',
        12: 'Private Thread',
        13: 'Stage Channel',
        15: 'Forum Channel'
    };

    const embed = new EmbedBuilder()
        .setTitle(`📋 Channel Information: ${channel.name}`)
        .setColor('#0099ff')
        .addFields(
            { name: 'Channel ID', value: channel.id, inline: true },
            { name: 'Type', value: typeNames[channel.type] || 'Unknown', inline: true },
            { name: 'Created', value: moment(channel.createdAt).format('YYYY-MM-DD HH:mm:ss'), inline: true }
        )
        .setTimestamp();

    if (channel.type === 0) { // Text channel
        embed.addFields(
            { name: 'Topic', value: channel.topic || 'No topic set', inline: false },
            { name: 'Slowmode', value: channel.rateLimitPerUser > 0 ? `${channel.rateLimitPerUser} seconds` : 'None', inline: true },
            { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true }
        );
    } else if (channel.type === 2) { // Voice channel
        embed.addFields(
            { name: 'User Limit', value: channel.userLimit > 0 ? channel.userLimit.toString() : 'No limit', inline: true },
            { name: 'Bitrate', value: `${channel.bitrate} kbps`, inline: true }
        );
    }

    if (channel.parent) {
        embed.addFields({ name: 'Category', value: channel.parent.name, inline: true });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Utility Functions
async function handleAvatar(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    
    const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 4096, dynamic: true }))
        .setColor('#0099ff')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleUserInfo(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);
    
    const embed = new EmbedBuilder()
        .setTitle(`👤 User Information: ${user.tag}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor('#0099ff')
        .addFields(
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Username', value: user.username, inline: true },
            { name: 'Discriminator', value: user.discriminator, inline: true },
            { name: 'Account Created', value: moment(user.createdAt).format('YYYY-MM-DD HH:mm:ss'), inline: true },
            { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
            { name: 'System', value: user.system ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

    if (member) {
        embed.addFields(
            { name: 'Nickname', value: member.nickname || 'None', inline: true },
            { name: 'Joined Server', value: moment(member.joinedAt).format('YYYY-MM-DD HH:mm:ss'), inline: true },
            { name: 'Roles', value: member.roles.cache.size > 1 ? member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.name).join(', ') : 'None', inline: false }
        );
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleBotInfo(interaction) {
    const uptime = process.uptime();
    const uptimeString = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    
    const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Information')
        .setThumbnail(client.user.displayAvatarURL())
        .setColor('#0099ff')
        .addFields(
            { name: 'Bot Name', value: client.user.username, inline: true },
            { name: 'Bot ID', value: client.user.id, inline: true },
            { name: 'Discord.js Version', value: require('discord.js').version, inline: true },
            { name: 'Node.js Version', value: process.version, inline: true },
            { name: 'Uptime', value: uptimeString, inline: true },
            { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true },
            { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
            { name: 'Users', value: client.users.cache.size.toString(), inline: true },
            { name: 'Channels', value: client.channels.cache.size.toString(), inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handlePing(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setColor('#00ff00')
        .addFields(
            { name: 'Latency', value: `${latency}ms`, inline: true },
            { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
}

async function handleUptime(interaction) {
    const uptime = process.uptime();
    const uptimeString = `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    
    const embed = new EmbedBuilder()
        .setTitle('⏰ Bot Uptime')
        .setDescription(`The bot has been running for **${uptimeString}**`)
        .setColor('#0099ff')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// Fun Functions
async function handle8Ball(interaction) {
    const question = interaction.options.getString('question');
    const responses = [
        'It is certain.',
        'It is decidedly so.',
        'Without a doubt.',
        'Yes definitely.',
        'You may rely on it.',
        'As I see it, yes.',
        'Most likely.',
        'Outlook good.',
        'Yes.',
        'Signs point to yes.',
        'Reply hazy, try again.',
        'Ask again later.',
        'Better not tell you now.',
        'Cannot predict now.',
        'Concentrate and ask again.',
        'Don\'t count on it.',
        'My reply is no.',
        'My sources say no.',
        'Outlook not so good.',
        'Very doubtful.'
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    
    const embed = new EmbedBuilder()
        .setTitle('🎱 Magic 8-Ball')
        .addFields(
            { name: 'Question', value: question, inline: false },
            { name: 'Answer', value: response, inline: false }
        )
        .setColor('#9B59B6')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleDice(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const count = interaction.options.getInteger('count') || 1;
    
    const results = [];
    let total = 0;
    
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        results.push(roll);
        total += roll;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🎲 Dice Roll')
        .setDescription(`Rolled ${count} d${sides}${count > 1 ? 's' : ''}`)
        .addFields(
            { name: 'Results', value: results.join(', '), inline: true },
            { name: 'Total', value: total.toString(), inline: true }
        )
        .setColor('#E74C3C')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCoinFlip(interaction) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const emoji = result === 'Heads' ? '🟡' : '⚫';
    
    const embed = new EmbedBuilder()
        .setTitle('🪙 Coin Flip')
        .setDescription(`${emoji} **${result}**`)
        .setColor('#F1C40F')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleJoke(interaction) {
    const jokes = [
        'Why don\'t scientists trust atoms? Because they make up everything!',
        'Why did the scarecrow win an award? He was outstanding in his field!',
        'Why don\'t eggs tell jokes? They\'d crack each other up!',
        'What do you call a fake noodle? An impasta!',
        'Why did the math book look so sad? Because it had too many problems!',
        'What do you call a bear with no teeth? A gummy bear!',
        'Why don\'t skeletons fight each other? They don\'t have the guts!',
        'What do you call a fish with no eyes? Fsh!',
        'Why did the coffee file a police report? It got mugged!',
        'What do you call a cow with no legs? Ground beef!'
    ];

    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    
    const embed = new EmbedBuilder()
        .setTitle('😄 Random Joke')
        .setDescription(joke)
        .setColor('#FFD700')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleMeme(interaction) {
    try {
        const response = await fetch('https://api.imgflip.com/get_memes');
        const data = await response.json();
        
        if (data.success) {
            const memes = data.data.memes;
            const randomMeme = memes[Math.floor(Math.random() * memes.length)];
            
            const embed = new EmbedBuilder()
                .setTitle('😂 Random Meme')
                .setDescription(randomMeme.name)
                .setImage(randomMeme.url)
                .setColor('#FF6B6B')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ content: 'Sorry, couldn\'t fetch a meme right now. Try again later!', ephemeral: true });
        }
    } catch (error) {
        await interaction.reply({ content: 'Sorry, couldn\'t fetch a meme right now. Try again later!', ephemeral: true });
    }
}

// Server Configuration Functions
async function handleSetPrefix(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'You need administrator permissions to use this command!', ephemeral: true });
    }

    const prefix = interaction.options.getString('prefix');

    db.run(
        'INSERT OR REPLACE INTO server_settings (guild_id, prefix) VALUES (?, ?)',
        [interaction.guild.id, prefix],
        function(err) {
            if (err) {
                interaction.reply({ content: 'Failed to set prefix.', ephemeral: true });
            } else {
                interaction.reply({ 
                    content: `✅ Successfully set prefix to \`${prefix}\``,
                    ephemeral: true 
                });
            }
        }
    );
}

async function handleSetWelcome(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'You need administrator permissions to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Welcome {user} to {server}!';

    db.run(
        'INSERT OR REPLACE INTO server_settings (guild_id, welcome_channel_id, welcome_message) VALUES (?, ?, ?)',
        [interaction.guild.id, channel.id, message],
        function(err) {
            if (err) {
                interaction.reply({ content: 'Failed to set welcome channel.', ephemeral: true });
            } else {
                interaction.reply({ 
                    content: `✅ Successfully set welcome channel to ${channel} with message: \`${message}\``,
                    ephemeral: true 
                });
            }
        }
    );
}

async function handleSetLeave(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'You need administrator permissions to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || '{user} has left {server}.';

    db.run(
        'INSERT OR REPLACE INTO server_settings (guild_id, leave_channel_id, leave_message) VALUES (?, ?, ?)',
        [interaction.guild.id, channel.id, message],
        function(err) {
            if (err) {
                interaction.reply({ content: 'Failed to set leave channel.', ephemeral: true });
            } else {
                interaction.reply({ 
                    content: `✅ Successfully set leave channel to ${channel} with message: \`${message}\``,
                    ephemeral: true 
                });
            }
        }
    );
}

async function handleSetLogChannel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: 'You need administrator permissions to use this command!', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');

    db.run(
        'INSERT OR REPLACE INTO server_settings (guild_id, log_channel_id) VALUES (?, ?)',
        [interaction.guild.id, channel.id],
        function(err) {
            if (err) {
                interaction.reply({ content: 'Failed to set log channel.', ephemeral: true });
            } else {
                interaction.reply({ 
                    content: `✅ Successfully set log channel to ${channel}`,
                    ephemeral: true 
                });
            }
        }
    );
}

async function handleServerInfo(interaction) {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner();
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 Server Information: ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .setColor('#0099ff')
        .addFields(
            { name: 'Server ID', value: guild.id, inline: true },
            { name: 'Owner', value: `${owner.user.tag}`, inline: true },
            { name: 'Created', value: moment(guild.createdAt).format('YYYY-MM-DD HH:mm:ss'), inline: true },
            { name: 'Members', value: guild.memberCount.toString(), inline: true },
            { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
            { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
            { name: 'Emojis', value: guild.emojis.cache.size.toString(), inline: true },
            { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true },
            { name: 'Boosters', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true }
        )
        .setTimestamp();

    if (guild.description) {
        embed.setDescription(guild.description);
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleServerIcon(interaction) {
    const guild = interaction.guild;
    
    if (!guild.iconURL()) {
        return interaction.reply({ content: 'This server doesn\'t have an icon!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
        .setTitle(`${guild.name}'s Server Icon`)
        .setImage(guild.iconURL({ size: 4096, dynamic: true }))
        .setColor('#0099ff')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// Login
client.login(process.env.DISCORD_TOKEN);