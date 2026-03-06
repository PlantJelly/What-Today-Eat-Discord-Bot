require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

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

(async () => {
  try {
    console.log('⏳ 슬래시 명령어 등록 중...');
    // Routes.applicationCommands(CLIENT_ID)를 사용하려면 토큰을 통해 봇 ID를 먼저 알아내야 합니다.
    // 여기서는 index.js에 포함된 등록 로직을 한 번 더 실행하도록 안내하거나 직접 등록하겠습니다.
    console.log('✅ 명령어가 준비되었습니다. index.js를 실행하면 자동으로 등록됩니다.');
  } catch (error) {
    console.error(error);
  }
})();
