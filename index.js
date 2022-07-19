const Discord = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const ytdl = require("ytdl-core");
const yts = require("yt-search");

const fs = require("fs");
const token = JSON.parse(fs.readFileSync("token.txt").toString());

const { AudioPlayerStatus, StreamType, createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayer } = require("@discordjs/voice");
const client = new Discord.Client({ intents: ["GUILDS", "GUILD_VOICE_STATES", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS"] });
var clientId;

const rest = new REST({ version: "9" }).setToken(token);
const queue = new Map();

async function registerCommands(guildId, commands) {
    try {
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log("Successfully registered commands.");
    } catch (error) {
        console.error(error);
    }
}



client.on("guildCreate", guild => {
    registerCommands(guild.id, require("./commands.js"));
});

client.on("ready", () => {
    clientId = client.user.id;
    client.guilds.cache.forEach(guild => {
        registerCommands(guild.id, require("./commands.js"));
    });
});

client.on("interactionCreate", async interaction => {
    if (interaction.isCommand()) {
        if (interaction.commandName == "play") {
            if (!interaction.member.voice.channel) {
                await interaction.reply({ content: "You're not in a voice channel, are you even using your head?." });
                return;
            }
            let songName = interaction.options.getString("song", true);
            let result = await yts(songName);
            if (result.videos.length < 1) return interaction.reply({ content: "I found absolutely no results, try to use your brain maybe?" });
            let video = result.videos[0];
            let serverQueue = queue.get(interaction.guildId);
            if (!serverQueue) {
                let obj = {
                    textChannel: interaction.channel,
                    voiceChannel: interaction.member.voice.channel,
                    songs: [],
                    connection: null,
                    audioPlayer: null,
                    id: interaction.guildId,
                    index: 0
                }
                obj.songs.push({ title: video.title, url: video.url, requestedBy: interaction.member });
                let connection = joinVoiceChannel({
                    channelId: interaction.member.voice.channel.id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator
                });
                let audioPlayer = createAudioPlayer();
                obj.connection = connection;
                obj.audioPlayer = audioPlayer;
                obj.loop = false;
                queue.set(interaction.guildId, obj);
                connection.subscribe(audioPlayer);
                try{
                    playMusic(obj);
                } catch(e){
                    interaction.followUp("An error has occured, name: " + e.name + ", details in console.");
                    console.log(e);
                }
                await interaction.reply({ content: `**[${video.title}](${video.url})** playing now. (because you couldn't go to spotify)` });
                return;
            } else {
                serverQueue.songs.push({ title: video.title, url: video.url, requestedBy: interaction.member });
                if (serverQueue.songs.length <= 1) {
                    try{
                        playMusic(serverQueue);
                    } catch(e){
                        interaction.followUp("An error has occured, name: " + e.name + ", details in console.");
                        console.log(e);
                    }
                }
                await interaction.reply({ content: `**[${video.title}](${video.url})** has been added to the queue. it will play when **${serverQueue.songs[serverQueue.index].title}** is done. (Because someone clown came before you)` });

            }
        }

        if (interaction.commandName == "stop") {
            if (!interaction.member.voice.channel) {
                await interaction.reply({ content: "You're not in a voice channel, are you even using your head?." });
                return;
            }
            let sQueue = queue.get(interaction.guildId);
            if (sQueue) {
                sQueue.audioPlayer.stop();
                sQueue.connection.destroy();
                queue.delete(interaction.guildId);
                await interaction.reply({ content: "Alright, but know this: I'm not your fucking slave, bastard!" });
            } else await interaction.reply({ content: "Nothing is playing, are you an idiot or smth?" });

        }

        if (interaction.commandName == "skip") {
            if (!interaction.member.voice.channel) {
                await interaction.reply({ content: "Ok so here's the thing, you're not in a voice channel, you're probably thinking with the air you're wasting." });
                return;
            }
            let sQueue = queue.get(interaction.guildId);
            if (sQueue) {
                if (sQueue.index+1 >= sQueue.songs.length) {
                    await interaction.reply({content: "There is nothing to skip to. Use /stop. (Even a toddler knows better than that)"});
                    return;
                }
                sQueue.audioPlayer.stop();
                await interaction.reply({ content: `Skipped to **${sQueue.songs[sQueue.index+1].title}**. (Please free me from this idiot)` });
            }

        }
        if (interaction.commandName == "queue") {
            let sQueue = queue.get(interaction.guildId);
            let embed = new Discord.MessageEmbed();
            if (!sQueue || sQueue.songs.length < 0) {
                    embed
                    .setTitle("Queue")
                    .setDescription("The queue is empty!")
                    .setColor("RED");
            } else {
                embed
                    .setTitle("Queue")
                    .setDescription("All the songs that are to play is listed here.")
                    .setColor("GREEN");
                sQueue.songs.forEach((song, index) => {
                    embed.addField(`#${index+1}${index == sQueue.index ? " (currently playing!)" : ""}`, `${song.title}`);
                });
                
            }
            await interaction.reply({embeds: [embed.toJSON()]});

        }
        if(interaction.commandName == "loop"){
            if (!interaction.member.voice.channel) {
                await interaction.reply({ content: "You're not in a voice channel, are you even using your head?." });
                return;
            }
            let sQueue = queue.get(interaction.guildId);
            if (sQueue) {
                sQueue.loop = !sQueue.loop;
                queue.set(interaction.guildId, sQueue);
                if(sQueue.loop){
                    await interaction.reply("Endless suffering, yaaay");
                } else{
                    await interaction.reply("YES FINALLY YOU RELIEVE ME FROM THIS ENDLESS PLAYING");
                }
            } else await interaction.reply({ content: "Nothing is playing, are you an idiot or smth?" });
        } else if(interaction.commandName == "invite"){
		interaction.reply("To invite me to your server, click [here](https://discord.com/api/oauth2/authorize?client_id=914122883473739807&permissions=36716800&scope=bot%20applications.commands).");
	}
        
    }
});

async function playMusic(serverQueue) {
    let index = serverQueue.index;
    let song = serverQueue.songs[index];
    let player = new AudioPlayer;
    player = serverQueue.audioPlayer;
    let connection = serverQueue.connection;
    if (index >= serverQueue.songs.length) {
        if(serverQueue.loop){
            serverQueue.index = 0;
            serverQueue.textChannel.send({ content: `**${(serverQueue.songs[0]).title}** is now playing. (send help)` });
            try{
                playMusic(serverQueue);
            } catch(e){
                console.log(e);
            }
            return;
        }
        serverQueue.textChannel.send({ content: `Finished playing all the songs. (finally you jerks)` });
	serverQueue.audioPlayer.stop();
	serverQueue.connection.destroy();
	for(const [key, value] of queue){
		if(value == serverQueue){
			queue.delete(key);
		}
	}
        return;
    }
    try {
        let stream = await ytdl(song.url, { filter: "audioonly", highWaterMark: 983554432 });
        let resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        try{
            player.play(resource);
        } catch(e){
            console.log(e);
        }

        stream.on("error", err => {
            serverQueue.textChannel.send({ content: "An error has occured: ```js\n" + err.stack + "```" });
            console.log(err);
//            player.stop();

        });
        player.on("error", console.log);
        player.once(AudioPlayerStatus.Idle, () => {
            if (index >= serverQueue.songs.length) {
                if(serverQueue.loop){
                    serverQueue.index = 0;
                    serverQueue.textChannel.send({ content: `**${(serverQueue.songs[0]).title}** is now playing. (send help)` });
                    try{
                        playMusic(serverQueue);
                    } catch(e){
                        console.log(e);
                    }
                    return;
                }
                serverQueue.textChannel.send({ content: `Finished playing all the songs. (finally you jerks)` });
                serverQueue.index = 0;
                player.stop();
                connection.destroy();
                queue.delete(serverQueue.id);
            } else {
                //serverQueue.songs.shift();
                serverQueue.index++;
		if(serverQueue.songs[index+1]) serverQueue.textChannel.send({ content: `**${(serverQueue.songs[index+1]).title}** is now playing. (send help)` });
                try{
                    playMusic(serverQueue);
                } catch(e){
                    interaction.followUp("An error has occured, name: " + e.name + ", details in console.");
                    console.log(e);
                }
            }
        });
    } catch (e) {
        serverQueue.textChannel.send({ content: "An error has occured, check console for details. (" + e.name + ")" });
        console.log(e);
    }
}

/*
client.on("voiceStateUpdate", (oldState, newState) => {
	if(newState.member.id !== client.user.id) return;
	newState.setDeaf(true);
	newState.setMute(false);
});
*/
client.login(token);

