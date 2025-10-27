require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const cheerio = require('cheerio');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const html = fs.readFileSync('modlist.html', 'utf8');
const $ = cheerio.load(html);

const mods = [];
$('li').each((_, el) => {
  const name = $(el).text();
  const link = $(el).find('a').attr('href');
  mods.push(`[${name}](${link})`);
});

const modList = mods.slice(0, 10).join('\n');

async function getServerStatus(ip) {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${ip}`);
    if (!res.ok) throw new Error("Request failed");
    return res.json();
}

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
	new SlashCommandBuilder()
        .setName('ip')
        .setDescription('Replies with the server ip.'),
	new SlashCommandBuilder()
        .setName('420')
        .setDescription('Admin command for creating 420 role message.'),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check the Minecraft server status.'),
	new SlashCommandBuilder()
		.setName('mods')
		.setDescription('View all the mods on the server.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Refreshing application (/) commands...');
        await rest.put(
            Routes.applicationCommands('1427289713571532911'),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'ping') {
        return await interaction.reply('Pong!');
    }

	 if (interaction.commandName === 'ip') {
        return await interaction.reply('`mc.sloorjuice.com`');
    }

	if (interaction.commandName === 'mods') {
		const modsPerPage = 20;
		const totalPages = Math.ceil(mods.length / modsPerPage);

		function getEmbed(page) {
			const start = page * modsPerPage;
			const end = start + modsPerPage;
			const pageMods = mods.slice(start, end).join('\n');
			return new EmbedBuilder()
				.setColor(0x57F287)
				.setTitle('Server Mod List')
				.setDescription(pageMods)
				.setFooter({ text: `Page ${page + 1} of ${totalPages}`, iconURL: client.user.displayAvatarURL() })
				.setTimestamp();
		}

		function getRow(page) {
			return new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('prev_mods')
					.setEmoji('⬅️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId('next_mods')
					.setEmoji('➡️')
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page === totalPages - 1)
			);
		}

		let page = 0;
		await interaction.reply({
			embeds: [getEmbed(page)],
			components: [getRow(page)]
		});

		const collector = interaction.channel.createMessageComponentCollector({
			filter: i => i.user.id === interaction.user.id,
			time: 60000
		});

		collector.on('collect', async i => {
			if (i.customId === 'prev_mods') page--;
			if (i.customId === 'next_mods') page++;
			await i.update({
				embeds: [getEmbed(page)],
				components: [getRow(page)]
			});
		});

		collector.on('end', async () => {
			try {
				await interaction.editReply({ components: [] });
			} catch (e) {}
		});

		return;
	}

    if (interaction.commandName === 'status') {
        const ip = 'mc.sloorjuice.com';
        await interaction.deferReply();

        try {
            const start = Date.now();
            const result = await getServerStatus(ip);
            const latency = Date.now() - start;

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle(`${ip} is Online`)
                .setDescription(result.motd?.clean || 'No MOTD provided.')
                .addFields(
                    { name: 'Players', value: `${result.players.online}/${result.players.max}`, inline: true },
                    { name: 'Version', value: result.version?.name_clean || 'Unknown', inline: true },
                    { name: 'Ping', value: `${latency}ms`, inline: true },
                    { name: 'Server Type', value: 'fabric', inline: true },
					{ name: 'Mods', value: modList, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'SloorBot Server Monitor', iconURL: client.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle(`${ip} is Offline`)
                .setDescription('The server could not be reached.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    }

    if (interaction.commandName === '420') {
        // Only allow admins to run this command
        if (!interaction.member.permissions.has('Administrator')) {
            await interaction.reply({ content: 'Only admins can use this command.', ephemeral: true });
            return;
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('420_checkmark')
                .setEmoji('✅')
                .setLabel('I am 420 friendly')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({
            content: 'Click the checkmark if you\'re 420 friendly to get access to the #420 text channel!',
            components: [row]
        });

        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply();
        return;
    }

    if (interaction.isButton() && interaction.customId === '420_checkmark') {
        const roleId = '1427323738147524689';
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(roleId);
        await interaction.reply({ content: 'You now have access to #420!', ephemeral: true});
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);
