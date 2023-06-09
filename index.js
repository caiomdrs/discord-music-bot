require('dotenv').config()

const fs = require('fs');
const Discord = require('discord.js');
const Client = require('./client/Client');
const config = require('./config.json');
const {Player} = require('discord-player');

const { ActivityType } = require('discord.js');

const client = new Client();
client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

console.log(client.commands);

const player = new Player(client);

player.on('connectionCreate', (queue) => {
    queue.connection.voiceConnection.on('stateChange', (oldState, newState) => {
      const oldNetworking = Reflect.get(oldState, 'networking');
      const newNetworking = Reflect.get(newState, 'networking');

      const networkStateChangeHandler = (oldNetworkState, newNetworkState) => {
        const newUdp = Reflect.get(newNetworkState, 'udp');
        clearInterval(newUdp?.keepAliveInterval);
      }

      oldNetworking?.off('stateChange', networkStateChangeHandler);
      newNetworking?.on('stateChange', networkStateChangeHandler);
    });
});

player.on('error', (queue, error) => {
  console.log(`[${queue.guild.name}] Deu erro nessa porra: ${error.message}`);
});

player.on('connectionError', (queue, error) => {
  console.log(`[${queue.guild.name}] Ta dando erro de conexao: ${error.message}`);
});

player.on('trackStart', (queue, track) => {
  queue.metadata.send(`▶ | BOTANDO PRA POCAR: **${track.title}** NO **${queue.connection.channel.name}**!`);
});

player.on('trackAdd', (queue, track) => {
  queue.metadata.send(`🎶 | FECHOU FML **${track.title}** TA NA FILA!`);
});

player.on('botDisconnect', queue => {
  queue.metadata.send('❌ | Cai do canal, perdi o pendrive');
});

player.on('channelEmpty', queue => {
  queue.metadata.send('❌ | Me abandonaram, To saindo');
});

player.on('queueEnd', queue => {
  queue.metadata.send('✅ | Acabou as musicas do pendrive');
});

client.once('ready', async () => {
  console.log('Rodando!');
});

client.on('ready', function() {
  client.user.setPresence({
    activities: [{ name: config.activity, type: Number(config.activityType) }],
    status: Discord.PresenceUpdateStatus.Online,
  });
});

client.once('reconnecting', () => {
  console.log('Reconnecting!');
});

client.once('disconnect', () => {
  console.log('Disconnect!');
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;
  if (!client.application?.owner) await client.application?.fetch();

  if (message.content === '!deploy' && message.author.id === client.application?.owner?.id) {
    await message.guild.commands
      .set(client.commands)
      .then(() => {
        message.reply('Deployed!');
      })
      .catch(err => {
        message.reply('Could not deploy commands! Make sure the bot has the application.commands permission!');
        console.error(err);
      });
  }
});

client.on('interactionCreate', async interaction => {
  const command = client.commands.get(interaction.commandName.toLowerCase());

  try {
    if (interaction.commandName == 'ban' || interaction.commandName == 'userinfo') {
      command.execute(interaction, client);
    } else {
      command.execute(interaction, player);
    }
  } catch (error) {
    console.error(error);
    interaction.followUp({
      content: 'There was an error trying to execute that command!',
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
