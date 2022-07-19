const { SlashCommandBuilder } = require("@discordjs/builders");
module.exports = [
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays a song, or adds it to queue")
        .addStringOption(option => {
            option.setName("song")
                .setDescription("The song name")
                .setRequired(true);
            return option;
        }).toJSON(),

    new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stops a song")
        .toJSON(),
    new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skips a song")
        .toJSON(),
    new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Views the queue")
        .toJSON(),
    new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Makes the queue play from the start when it has finished all the songs.")
        .toJSON(),
    new SlashCommandBuilder()
	.setName("invite")
	.setDescription("Invite me to your server.")
	.toJSON(),

]
