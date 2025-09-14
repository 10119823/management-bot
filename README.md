# Discord Community Management Bot

A comprehensive Discord bot designed for advanced community management with **50+ commands** including moderation tools, role management, channel management, server configuration, utility commands, fun commands, auto-moderation, logging, and user management features.

## 🚀 Features

### Core Moderation Commands
- **`/ban`** - Ban users with optional message deletion
- **`/kick`** - Kick users from the server
- **`/unban`** - Unban previously banned users
- **`/blacklist`** - Add users to blacklist (auto-kick on join)
- **`/unblacklist`** - Remove users from blacklist
- **`/viewuser`** - View detailed user information and moderation history

### Advanced Moderation Features
- **`/warn`** - Issue warnings to users
- **`/mute`** - Timeout users (1 minute to 7 days)
- **`/unmute`** - Remove timeout from users
- **`/purge`** - Bulk delete messages (with optional user filter)
- **`/automod`** - Configure auto-moderation settings
- **`/stats`** - View server statistics

### Role Management Commands
- **`/addrole`** - Add a role to a user
- **`/removerole`** - Remove a role from a user
- **`/createrole`** - Create a new role with custom properties
- **`/deleterole`** - Delete a role
- **`/roleinfo`** - Get detailed information about a role
- **`/massrole`** - Add or remove roles from multiple users at once

### Channel Management Commands
- **`/createchannel`** - Create text, voice, or category channels
- **`/deletechannel`** - Delete channels
- **`/lockchannel`** - Lock a channel (prevent messages)
- **`/unlockchannel`** - Unlock a channel
- **`/slowmode`** - Set slowmode for channels (0-21600 seconds)
- **`/channelinfo`** - Get detailed channel information

### Server Configuration Commands
- **`/setprefix`** - Set custom bot prefix for the server
- **`/setwelcome`** - Configure welcome channel and message
- **`/setleave`** - Configure leave channel and message
- **`/setlogchannel`** - Set moderation log channel
- **`/serverinfo`** - Get detailed server information
- **`/servericon`** - Display server icon

### Utility Commands
- **`/avatar`** - Get user avatars in high resolution
- **`/userinfo`** - Get detailed user information
- **`/botinfo`** - Get bot statistics and information
- **`/ping`** - Check bot latency
- **`/uptime`** - Check bot uptime

### Fun Commands
- **`/8ball`** - Ask the magic 8-ball questions
- **`/dice`** - Roll dice with custom sides and count
- **`/coinflip`** - Flip a coin
- **`/joke`** - Get random jokes
- **`/meme`** - Get random memes from Imgflip API

### Auto-Moderation
- **Spam Detection** - Automatically detects and prevents spam
- **Blacklist Enforcement** - Auto-kicks blacklisted users on join
- **Welcome System** - Welcomes new members with custom messages
- **Activity Logging** - Comprehensive logging of all moderation actions

### Database Features
- **User Profiles** - Track warnings, kicks, bans, and activity
- **Moderation Logs** - Complete audit trail of all actions
- **Blacklist Management** - Persistent blacklist storage
- **Auto-moderation Settings** - Configurable moderation thresholds

## 📋 Prerequisites

- Node.js (v16.9.0 or higher)
- A Discord application and bot token
- Discord server with appropriate permissions

## 🛠️ Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd discord-community-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot token and configuration:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_bot_client_id_here
   GUILD_ID=your_guild_id_here
   LOG_CHANNEL_ID=your_log_channel_id_here
   WELCOME_CHANNEL_ID=your_welcome_channel_id_here
   MODERATOR_ROLE_ID=your_moderator_role_id_here
   ADMIN_ROLE_ID=your_admin_role_id_here
   ```

4. **Start the bot**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

## 🔧 Discord Bot Setup

### 1. Create a Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the bot token and paste it in your `.env` file

### 2. Set Bot Permissions
The bot requires the following permissions:
- `Send Messages`
- `Manage Messages`
- `Kick Members`
- `Ban Members`
- `Moderate Members`
- `Read Message History`
- `View Channels`
- `Read Messages/View Channels`

### 3. Invite Bot to Server
1. Go to OAuth2 > URL Generator
2. Select "bot" and "applications.commands" scopes
3. Select the required permissions
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 4. Get Required IDs
- **Guild ID**: Right-click your server name → Copy Server ID
- **Channel IDs**: Right-click channel → Copy Channel ID
- **Role IDs**: Right-click role → Copy Role ID

## 📖 Command Documentation

### Moderation Commands

#### `/ban <user> [reason] [delete_messages]`
Bans a user from the server.
- **user**: The user to ban (required)
- **reason**: Reason for the ban (optional)
- **delete_messages**: Days of messages to delete 0-7 (optional)

#### `/kick <user> [reason]`
Kicks a user from the server.
- **user**: The user to kick (required)
- **reason**: Reason for the kick (optional)

#### `/unban <user_id> [reason]`
Unbans a previously banned user.
- **user_id**: The user ID to unban (required)
- **reason**: Reason for the unban (optional)

#### `/blacklist <user> [reason]`
Adds a user to the blacklist (auto-kick on join).
- **user**: The user to blacklist (required)
- **reason**: Reason for blacklisting (optional)

#### `/unblacklist <user>`
Removes a user from the blacklist.
- **user**: The user to unblacklist (required)

#### `/viewuser <user>`
Shows detailed information about a user.
- **user**: The user to view (required)

### Advanced Commands

#### `/warn <user> <reason>`
Issues a warning to a user.
- **user**: The user to warn (required)
- **reason**: Reason for the warning (required)

#### `/mute <user> <duration> [reason]`
Times out a user (mutes them).
- **user**: The user to mute (required)
- **duration**: Duration in minutes 1-10080 (required)
- **reason**: Reason for the mute (optional)

#### `/unmute <user>`
Removes timeout from a user.
- **user**: The user to unmute (required)

#### `/purge <amount> [user]`
Deletes multiple messages.
- **amount**: Number of messages to delete 1-100 (required)
- **user**: Only delete messages from this user (optional)

#### `/automod <setting> <value>`
Configures auto-moderation settings (Admin only).
- **setting**: Setting to configure (spam_threshold, max_warnings, auto_ban_threshold)
- **value**: New value for the setting

#### `/stats`
Shows server statistics.

## 🔒 Permission System

The bot uses a role-based permission system:
- **Moderator Role**: Can use most moderation commands
- **Admin Role**: Can use all commands including automod configuration
- **Administrator Permission**: Full access to all features

## 📊 Database Schema

The bot uses SQLite database with the following tables:

### `blacklist`
- `id`: Primary key
- `user_id`: Discord user ID
- `reason`: Blacklist reason
- `moderator_id`: ID of moderator who blacklisted
- `created_at`: Timestamp

### `moderation_logs`
- `id`: Primary key
- `action`: Action performed
- `user_id`: Target user ID
- `moderator_id`: Moderator ID
- `reason`: Action reason
- `created_at`: Timestamp

### `user_profiles`
- `user_id`: Discord user ID (primary key)
- `warnings`: Number of warnings
- `kicks`: Number of kicks
- `bans`: Number of bans
- `join_date`: When user joined
- `last_seen`: Last activity

### `automod_settings`
- `id`: Primary key
- `setting_name`: Setting identifier
- `setting_value`: Setting value
- `enabled`: Whether setting is active

## 🚨 Auto-Moderation

The bot includes several auto-moderation features:

1. **Spam Detection**: Automatically detects and deletes spam messages
2. **Blacklist Enforcement**: Auto-kicks blacklisted users when they join
3. **Welcome System**: Sends welcome messages to new members
4. **Activity Tracking**: Tracks user activity and last seen times

## 📝 Logging

All moderation actions are logged to a designated channel with:
- Action type and target user
- Moderator who performed the action
- Reason for the action
- Timestamp
- Additional information (duration, etc.)

## 🔧 Configuration

### Environment Variables
- `DISCORD_TOKEN`: Your bot token
- `CLIENT_ID`: Your bot's client ID
- `GUILD_ID`: Your server ID
- `LOG_CHANNEL_ID`: Channel for moderation logs
- `WELCOME_CHANNEL_ID`: Channel for welcome messages
- `MODERATOR_ROLE_ID`: Role ID for moderators
- `ADMIN_ROLE_ID`: Role ID for administrators

### Auto-Moderation Settings
- `spam_threshold`: Number of messages in timeframe to trigger spam detection
- `spam_timeframe`: Time window for spam detection (milliseconds)
- `max_warnings`: Maximum warnings before auto-action
- `auto_ban_threshold`: Number of violations before auto-ban

## 🐛 Troubleshooting

### Common Issues

1. **Bot not responding to commands**
   - Check if bot has proper permissions
   - Verify slash commands are registered
   - Check console for errors

2. **Permission denied errors**
   - Ensure bot has required permissions
   - Check role hierarchy
   - Verify user has moderator/admin role

3. **Database errors**
   - Check file permissions
   - Ensure SQLite is properly installed
   - Check console for database errors

### Getting Help

If you encounter issues:
1. Check the console output for error messages
2. Verify all environment variables are set correctly
3. Ensure the bot has proper permissions in your server
4. Check that all required channels and roles exist

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For support, please open an issue in the repository or contact the bot administrator.