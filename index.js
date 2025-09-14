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

    new SlashCommandBuilder()
        .setName('userstats')
        .setDescription('View detailed statistics for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view statistics for')
                .setRequired(true))
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
            case 'userstats':
                await handleUserStats(interaction);
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

async function handleUserStats(interaction) {
    if (!hasPermission(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    
    // Get user profile data
    db.get('SELECT * FROM user_profiles WHERE user_id = ?', [user.id], (err, profile) => {
        if (err) {
            return interaction.reply({ content: 'Error fetching user profile data.', ephemeral: true });
        }

        // Get moderation history counts
        const queries = [
            { query: 'SELECT COUNT(*) as count FROM moderation_logs WHERE user_id = ? AND action = ?', params: [user.id, 'ban'], name: 'bans' },
            { query: 'SELECT COUNT(*) as count FROM moderation_logs WHERE user_id = ? AND action = ?', params: [user.id, 'kick'], name: 'kicks' },
            { query: 'SELECT COUNT(*) as count FROM moderation_logs WHERE user_id = ? AND action = ?', params: [user.id, 'warn'], name: 'warnings' },
            { query: 'SELECT COUNT(*) as count FROM moderation_logs WHERE user_id = ? AND action = ?', params: [user.id, 'mute'], name: 'timeouts' },
            { query: 'SELECT COUNT(*) as count FROM moderation_logs WHERE user_id = ? AND action = ?', params: [user.id, 'unban'], name: 'unbans' }
        ];

        let completedQueries = 0;
        const stats = {};

        queries.forEach(({ query, params, name }) => {
            db.get(query, params, (err, row) => {
                if (err) {
                    console.error(`Error fetching ${name}:`, err);
                    stats[name] = 0;
                } else {
                    stats[name] = row.count;
                }
                
                completedQueries++;
                
                // When all queries are complete, create the embed
                if (completedQueries === queries.length) {
                    createUserStatsEmbed(interaction, user, profile, stats);
                }
            });
        });
    });
}

async function createUserStatsEmbed(interaction, user, profile, stats) {
    // Calculate total infractions
    const totalInfractions = stats.bans + stats.kicks + stats.warnings + stats.timeouts;
    
    // Determine user status
    let status = '🟢 Good Standing';
    let statusColor = '#00ff00';
    
    if (stats.bans > 0) {
        status = '🔴 Banned';
        statusColor = '#ff0000';
    } else if (stats.kicks > 2) {
        status = '🟡 Multiple Kicks';
        statusColor = '#ffaa00';
    } else if (stats.warnings > 3) {
        status = '🟡 Multiple Warnings';
        statusColor = '#ffaa00';
    } else if (totalInfractions > 0) {
        status = '🟡 Has Infractions';
        statusColor = '#ffaa00';
    }

    const embed = new EmbedBuilder()
        .setTitle(`📊 User Statistics: ${user.tag}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(statusColor)
        .addFields(
            { name: '👤 User Information', value: `**ID:** ${user.id}\n**Account Created:** ${moment(user.createdAt).format('YYYY-MM-DD HH:mm:ss')}\n**Status:** ${status}`, inline: false },
            { name: '📈 Infraction Summary', value: `**Total Infractions:** ${totalInfractions}\n**Bans:** ${stats.bans}\n**Kicks:** ${stats.kicks}\n**Warnings:** ${stats.warnings}\n**Timeouts:** ${stats.timeouts}`, inline: true },
            { name: '📅 Activity', value: `**Join Date:** ${profile?.join_date ? moment(profile.join_date).format('YYYY-MM-DD HH:mm:ss') : 'Unknown'}\n**Last Seen:** ${profile?.last_seen ? moment(profile.last_seen).format('YYYY-MM-DD HH:mm:ss') : 'Unknown'}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `User Statistics • Requested by ${interaction.user.tag}` });

    // Add additional info if user has been unbanned
    if (stats.unbans > 0) {
        embed.addFields({ name: '🔄 Restorations', value: `**Unbans:** ${stats.unbans}`, inline: true });
    }

    // Add warning message for high infraction counts
    if (totalInfractions > 5) {
        embed.addFields({ name: '⚠️ Warning', value: 'This user has a high number of infractions.', inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Login
client.login(process.env.DISCORD_TOKEN);