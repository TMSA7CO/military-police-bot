/* ═══════════════════════════════════════════════════════════
 *  الشرطة العسكرية | وزارة الدفاع الأمريكي
 *  حدث دخول عضو جديد — GuildMemberAdd.js
 *  الإصدار: 1.0
 *  الوظيفة:
 *    - إعطاء رتبة الدخول التلقائي
 *    - رسالة ترحيب في القناة
 *    - رسالة ترحيب في الخاص
 *    - لوق
 *  ═══════════════════════════════════════════════════════════ */

'use strict';

const { Events, EmbedBuilder } = require('discord.js');
const CONFIG = require('../config');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member, client) {
    try {
      /* ─── تجاهل البوتات والسيرفرات الأخرى ─── */
      if (member.user.bot) return;
      if (member.guild.id !== CONFIG.GUILD_ID) return;

      console.log(`\n[GuildMemberAdd] 👋 عضو جديد: ${member.user.tag}`);
      console.log(`   🆔 ${member.id}`);

      /* ═══════════════════════════════════════════════
       *  1. إعطاء رتبة الدخول التلقائي
       *  ═══════════════════════════════════════════════ */
      let roleAdded = false;
      try {
        if (CONFIG.ROLES.AUTO_JOIN) {
          await member.roles.add(CONFIG.ROLES.AUTO_JOIN, 'دخول تلقائي للسيرفر');
          roleAdded = true;
          console.log(`   ✅ تم إعطاء الرتبة التلقائية`);
        } else {
          console.warn(`   ⚠️ AUTO_JOIN غير محدد`);
        }
      } catch (roleErr) {
        console.error(`   ❌ فشل إعطاء الرتبة:`, roleErr.message);
      }

      /* ═══════════════════════════════════════════════
       *  2. رسالة الترحيب في القناة
       *  ═══════════════════════════════════════════════ */
      try {
        const welcomeChannelId = CONFIG.CHANNELS.WELCOME;
        if (welcomeChannelId) {
          const welcomeChannel = await client.channels.fetch(welcomeChannelId).catch(() => null);

          if (welcomeChannel && welcomeChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setColor(CONFIG.COLORS.SUCCESS)
              .setAuthor({
                name: 'وزارة الدفاع الأمريكي',
                iconURL: client.user.displayAvatarURL()
              })
              .setTitle('🎖️ مرحباً بك في السيرفر')
              .setDescription(
                `أهلاً بك ${member} في\n` +
                `**الشرطة العسكرية — وزارة الدفاع الأمريكي**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📌 **أنت العضو رقم:** \`${member.guild.memberCount}\`\n` +
                `📅 **تاريخ الدخول:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                `🔗 **رابط السيرفر:** ${CONFIG.TEXT.INVITE}`
              )
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setFooter({
                text: CONFIG.TEXT.FOOTER,
                iconURL: client.user.displayAvatarURL()
              })
              .setTimestamp();

            await welcomeChannel.send({
              content: `${member}`,
              embeds: [embed]
            }).catch(() => {});

            console.log(`   ✅ تم إرسال الترحيب في القناة`);
          } else {
            console.warn(`   ⚠️ قناة الترحيب غير موجودة: ${welcomeChannelId}`);
          }
        }
      } catch (chErr) {
        console.error(`   ❌ فشل الترحيب في القناة:`, chErr.message);
      }

      /* ═══════════════════════════════════════════════
       *  3. رسالة الترحيب في الخاص (DM)
       *  ═══════════════════════════════════════════════ */
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(CONFIG.COLORS.SUCCESS)
          .setAuthor({
            name: 'وزارة الدفاع الأمريكي',
            iconURL: client.user.displayAvatarURL()
          })
          .setTitle('🎖️ مرحباً بك')
          .setDescription(
            `أهلاً بك **${member.user.username}** في\n` +
            `**${member.guild.name}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🎯 نتمنى لك تجربة رائعة وممتعة\n` +
            `📖 اقرأ قوانين السيرفر جيداً\n` +
            `🤝 احترم جميع الأعضاء والإدارة`
          )
          .addFields({
            name: '🔗 رابط السيرفر',
            value: CONFIG.TEXT.INVITE,
            inline: false
          })
          .setThumbnail(member.guild.iconURL({ size: 256 }))
          .setFooter({
            text: CONFIG.TEXT.FOOTER,
            iconURL: client.user.displayAvatarURL()
          })
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] }).catch(() => {});
        console.log(`   ✅ تم إرسال DM الترحيب`);
      } catch (dmErr) {
        console.error(`   ⚠️ فشل DM (قد تكون الخاصية معطلة):`, dmErr.message);
      }

      /* ═══════════════════════════════════════════════
       *  4. لوق
       *  ═══════════════════════════════════════════════ */
      await logger.sendLog(client, 'member_joined', {
        description: `عضو جديد دخل السيرفر`,
        fields: [
          { name: '👤 العضو', value: member.user.tag, inline: true },
          { name: '🆔 الآيدي', value: `\`${member.id}\``, inline: true },
          {
            name: '📅 عمر الحساب',
            value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            inline: true
          },
          {
            name: '🎖️ رتبة الدخول',
            value: roleAdded ? '✅ أُعطيت' : '❌ فشلت',
            inline: true
          }
        ],
        userId: member.id,
        userName: member.user.tag,
        thumbnailUrl: member.user.displayAvatarURL()
      }).catch(() => {});

      console.log(`   ✅ اكتمل الترحيب`);

    } catch (err) {
      console.error('[GuildMemberAdd] خطأ:', err);
    }
  }
};