require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const TARGET_URL = 'https://www.kopo.ac.kr/seongnam/content.do?menu=4304';
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');

// 슬래시 명령어 정의
const commands = [
  new SlashCommandBuilder()
    .setName('식단')
    .setDescription('성남캠퍼스의 오늘의 식단을 확인합니다.')
    .addStringOption(option =>
      option.setName('요일')
        .setDescription('확인하고 싶은 요일을 선택하세요 (기본: 오늘)')
        .addChoices(
          { name: '오늘', value: '오늘' },
          { name: '내일', value: '내일' },
          { name: '월요일', value: '월요일' },
          { name: '화요일', value: '화요일' },
          { name: '수요일', value: '수요일' },
          { name: '목요일', value: '목요일' },
          { name: '금요일', value: '금요일' }
        )
    ),
  new SlashCommandBuilder()
    .setName('알림받기')
    .setDescription('매일 정해진 시간(08:00, 11:30, 17:00)에 식단 알림을 받습니다.'),
  new SlashCommandBuilder()
    .setName('알림해제')
    .setDescription('자동 식단 알림을 해제합니다.'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// 구독 정보 로드/저장 함수
function loadSubscriptions() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  try {
    const data = fs.readFileSync(SUBS_FILE);
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveSubscriptions(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

// 식단 정보 가져오기 공통 함수
async function fetchMeal(targetDayName, mealType) {
  try {
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);
    let mealText = '';

    $('.tbl_table tbody tr').each((i, el) => {
      const dayInTable = $(el).find('td').eq(0).text().trim();
      if (dayInTable.includes(targetDayName)) {
        const index = mealType === '조식' ? 1 : mealType === '중식' ? 2 : 3;
        mealText = $(el).find('td').eq(index).text().trim().replace(/\s+/g, ' ');
        return false;
      }
    });

    const isEmpty = (text) => !text || text === '(내용 없음)' || text === '내용 없음' || text.length < 2;
    return isEmpty(mealText) ? null : mealText;
  } catch (error) {
    console.error('식단 가져오기 실패:', error);
    return null;
  }
}

// 알림 전송 함수
async function sendScheduledMeal(mealType) {
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const todayName = dayNames[new Date().getDay()];
  
  const meal = await fetchMeal(todayName, mealType);
  if (!meal) return; // 식단이 없으면 안보냄

  const subs = loadSubscriptions();
  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle(`📢 오늘의 ${mealType} 안내 (${todayName})`)
    .setDescription(meal)
    .setTimestamp()
    .setFooter({ text: '성남캠퍼스 자동 알림' });

  for (const channelId of subs) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (e) {
      console.error(`채널 ${channelId}에 메시지 전송 실패:`, e);
    }
  }
}

client.once('ready', async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);
  
  // 명령어 자동 등록
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ 슬래시 명령어 등록 완료');
  } catch (e) { console.error('명령어 등록 실패:', e); }

  // 크론 스케줄 설정 (08:00 조식, 11:30 중식, 17:00 석식)
  cron.schedule('0 8 * * *', () => sendScheduledMeal('조식'), { timezone: "Asia/Seoul" });
  cron.schedule('30 11 * * *', () => sendScheduledMeal('중식'), { timezone: "Asia/Seoul" });
  cron.schedule('0 17 * * *', () => sendScheduledMeal('석식'), { timezone: "Asia/Seoul" });
  
  console.log('⏰ 자동 알림 스케줄러가 활성화되었습니다.');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === '식단') {
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const today = new Date();
    let targetDayName = dayNames[today.getDay()];
    const selectedDay = interaction.options.getString('요일');

    if (selectedDay === '내일') targetDayName = dayNames[(today.getDay() + 1) % 7];
    else if (selectedDay && selectedDay !== '오늘') targetDayName = selectedDay;

    await interaction.deferReply();
    const response = await axios.get(TARGET_URL);
    const $ = cheerio.load(response.data);
    let mealInfo = { b: '', l: '', d: '' };
    let found = false;

    $('.tbl_table tbody tr').each((i, el) => {
      if ($(el).find('td').eq(0).text().includes(targetDayName)) {
        mealInfo.b = $(el).find('td').eq(1).text().trim().replace(/\s+/g, ' ');
        mealInfo.l = $(el).find('td').eq(2).text().trim().replace(/\s+/g, ' ');
        mealInfo.d = $(el).find('td').eq(3).text().trim().replace(/\s+/g, ' ');
        found = true; return false;
      }
    });

    const isEmpty = (t) => !t || t === '(내용 없음)' || t.length < 2;
    if (!found || (isEmpty(mealInfo.b) && isEmpty(mealInfo.l) && isEmpty(mealInfo.d))) {
      return interaction.editReply(`❌ **${targetDayName}** 식단이 없습니다.`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00AE86).setTitle(`🍴 ${targetDayName} 식단`).setURL(TARGET_URL)
      .addFields(
        { name: '🌅 조식', value: isEmpty(mealInfo.b) ? '없음' : mealInfo.b },
        { name: '☀️ 중식', value: isEmpty(mealInfo.l) ? '없음' : mealInfo.l },
        { name: '🌙 석식', value: isEmpty(mealInfo.d) ? '없음' : mealInfo.d }
      );
    await interaction.editReply({ embeds: [embed] });

  } else if (interaction.commandName === '알림받기') {
    let subs = loadSubscriptions();
    if (!subs.includes(interaction.channelId)) {
      subs.push(interaction.channelId);
      saveSubscriptions(subs);
      await interaction.reply('✅ 이 채널에 매일 **08:00, 11:30, 17:00** 자동 식단 알림이 등록되었습니다!');
    } else {
      await interaction.reply('ℹ️ 이미 이 채널에 알림이 등록되어 있습니다.');
    }

  } else if (interaction.commandName === '알림해제') {
    let subs = loadSubscriptions();
    if (subs.includes(interaction.channelId)) {
      subs = subs.filter(id => id !== interaction.channelId);
      saveSubscriptions(subs);
      await interaction.reply('🔕 이 채널의 자동 식단 알림이 해제되었습니다.');
    } else {
      await interaction.reply('ℹ️ 등록된 알림이 없습니다.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);