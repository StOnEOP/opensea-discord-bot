import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';
const my_id = '<@211950823314292748>'

const discordBot = new Discord.Client();
const  discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
      resolve(channel as TextChannel);
    });
  })
}

const buildMessage = (sale: any) => (
  new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(sale.asset.name + ' sold!')
	.setURL(sale.asset.permalink)
	.setAuthor('NFT-Tracker', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png', 'https://github.com/sbauch/opensea-discord-bot')
	.setThumbnail(sale.asset.collection.image_url)
	.addFields(
		{ name: 'Name', value: sale.asset.name },
		{ name: 'Amount', value: `${ethers.utils.formatEther(sale.total_price || '0')}${ethers.constants.EtherSymbol}`},
		{ name: 'Buyer', value: sale?.winner_account?.address, },
		{ name: 'Seller', value: sale?.seller?.address,  },
	)
  .setImage(sale.asset.image_url)
	.setTimestamp(Date.parse(`${sale?.created_date}Z`))
	.setFooter('Sold on OpenSea', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png')
)

async function main() {
  var binary = true;
  const channel = await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  var split = process.env.ADRESSES.split(",");
  var params = [];
  var openSeaResponse = null;
  
  var i = 0

  for(i = 0; split.length > i; i++){
    //const params = new URLSearchParams({
    params[i] = new URLSearchParams({
      offset: '0',
      event_type: 'successful',
      only_opensea: 'false',
      occurred_after: hoursAgo.toString(),
      //collection_slug: process.env.COLLECTION_SLUG!,
      account_address: split[i],
    })

    //if (process.env.CONTRACT_ADDRESS !== OPENSEA_SHARED_STOREFRONT_ADDRESS) {
      //params.append('asset_contract_address', process.env.CONTRACT_ADDRESS!)
    //}

    openSeaResponse = await fetch(
      "https://api.opensea.io/api/v1/events?" + params[i]).then((resp) => resp.json());
      
    console.log("recieved response")
    await Promise.all(
      openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
        var j = 0;
        for(j = 0; split.length > j; j++){
          if (sale?.winner_account?.address === split[j]){
            console.log("Entered");
            binary = false;
            const message = buildMessage(sale);
            channel.send(my_id);
            return await channel.send(message);
          }
        }
      })
    );
  }
  if (binary) await channel.send('Nothing found');
  return Promise.all;
}

main()
  .then((res) =>{ 
    if (!res.length) console.log("No recent sales");
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
