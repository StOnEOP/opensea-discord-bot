import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";

const OPENSEA_SHARED_STOREFRONT_ADDRESS = '0x495f947276749Ce646f68AC8c248420045cb7b5e';
const my_id = '<@>';

const discordBot = new Discord.Client();
const  discordSetup = async (channel: string): Promise<TextChannel> => {
  const channelID = channel
  return new Promise<TextChannel>((resolve, reject) => {
    if (!process.env['DISCORD_BOT_TOKEN']) reject('DISCORD_BOT_TOKEN not set')
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(channelID!);
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
  const channel = await discordSetup(process.env.DISCORD_CHANNEL_ID);
  var binary = true;
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 1000;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  var split = process.env.ADRESSES.split(",");
  var params = [];
  var openSeaResponse = null;
  
  var i = 0

  for(i = 0; split.length > i; i++){
    console.log(split[i]);
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

    let responseText = "";

    let openSeaFetch = {}
    if (process.env.OPENSEA_TOKEN) {
      openSeaFetch['headers'] = {'X-API-KEY': process.env.OPENSEA_TOKEN}
    }

    try {
      const openSeaResponseObj = await fetch(
        "https://api.opensea.io/api/v1/events?" + params[i], openSeaFetch
      );

      responseText = await openSeaResponseObj.text();
      openSeaResponse = JSON.parse(responseText)
        
      console.log("recieved response")
      await Promise.all(
        openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
          
          if (sale.asset.name == null) sale.asset.name = 'Unnamed NFT';
          const message = buildMessage(sale);
          channel.send(my_id);
          binary = false;

          return await (await channel.send(message));
        })
      );
    } catch (e) {
      const payload = responseText || "";

      if (payload.includes("cloudflare") && payload.includes("1020")) {
        throw new Error("You are being rate-limited by OpenSea. Please retrieve an OpenSea API token here: https://docs.opensea.io/reference/request-an-api-key")
      }
    
      throw e;
    }
  }
  if(binary){
    return await (await channel.send("Nothing found"));
  }
  binary = true;
  return Promise.all;
}

main()
  .then((res) =>{
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
