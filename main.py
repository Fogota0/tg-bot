import logging
import random
import asyncio
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, CommandHandler, filters

# --- CONFIG ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
SOURCE_CHANNEL_ID = -1002822150379      # канал-источник
DESTINATION_CHAT_ID = -1002503385568    # чат/канал-получатель
# -------------------------------------------------

# --- Заглушка для Render (чтобы он не выключал бота) ---
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Bot is running")

def run_health_check():
    port = int(os.environ.get("PORT", 8000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    server.serve_forever()



logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# --- Ответы на /start ---
START_REPLIES = [
    "Я уже ничего не понимаю",
    "Бешеный выводок рулит",
    "Я в этот чат случайно зашла, но вы тут все гандоны",
    "Мне похуй",
    "Говорят, что во время течки оборотень Римуса поёбывал Сириуса в образе собаки. Сириус бы непротив.",
    "Сегодня среда",
    "Блядское ОСД и блядские фанаты геев",
    "Господи, благослови лоботомию",
    "Во вторник был отличный день, жаль, что вы все живы",
    "Трамп, Байден, Путин, Зеленский и Аспид. Знаете, что связывает всё это?"
]

# --- Пересылка сообщений из канала ---
async def forward_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    post = update.channel_post
    if not post or update.effective_chat.id != SOURCE_CHANNEL_ID:
        return

    # пропускаем пересылки
    is_forwarded = (
        getattr(post, "forward_origin", None) is not None
        or getattr(post, "forward_from_chat", None) is not None
        or getattr(post, "forward_from", None) is not None
        or getattr(post, "forward_sender_name", None) is not None
        or getattr(post, "forward_date", None) is not None
        or getattr(post, "is_automatic_forward", False)
    )
    if is_forwarded:
        logger.info("Пост является пересылкой — игнорирую.")
        return

    # проверка на петлю
    if post.via_bot and post.via_bot.id == context.bot.id:
        logger.info("Сообщение отправлено этим же ботом — игнорирую.")
        return

    try:
        if post.media_group_id:  # 📸 альбом
            group_id = post.media_group_id
            if "album_buffer" not in context.bot_data:
                context.bot_data["album_buffer"] = {}

            if group_id not in context.bot_data["album_buffer"]:
                context.bot_data["album_buffer"][group_id] = []
                # ждём чуть-чуть, чтобы собрать все части альбома
                asyncio.create_task(flush_album(context, group_id))

            context.bot_data["album_buffer"][group_id].append(post)

        else:  # обычное сообщение
            await context.bot.forward_message(
                chat_id=DESTINATION_CHAT_ID,
                from_chat_id=SOURCE_CHANNEL_ID,
                message_id=post.message_id
            )
            logger.info(f"Сообщение {post.message_id} переслано.")

    except Exception as e:
        logger.exception(f"Ошибка при пересылке: {e}")

try:
        await context.bot.forward_message(
            chat_id=DESTINATION_CHAT_ID,
            from_chat_id=SOURCE_CHANNEL_ID,
            message_id=post.message_id
        )
    except Exception as e:
        print(f"Ошибка: {e}")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(random.choice(START_REPLIES))


# --- Отправляем альбом целиком ---
async def flush_album(context: ContextTypes.DEFAULT_TYPE, group_id: str):
    await asyncio.sleep(2)  # ждём, пока Telegram пришлёт все части
    msgs = context.bot_data["album_buffer"].pop(group_id, [])
    for msg in msgs:
        try:
            await context.bot.forward_message(
                chat_id=DESTINATION_CHAT_ID,
                from_chat_id=SOURCE_CHANNEL_ID,
                message_id=msg.message_id
            )
            logger.info(f"Альбом: сообщение {msg.message_id} переслано.")
        except Exception as e:
            logger.error(f"Ошибка при пересылке альбома: {e}")


# --- Ответ на /start ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(random.choice(START_REPLIES))

def main():
    # Запускаем веб-сервер в отдельном потоке
    threading.Thread(target=run_health_check, daemon=True).start()

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.ChatType.CHANNEL, forward_message))
    app.add_handler(CommandHandler("start", start))

    print("Бот запущен…")
    app.run_polling(allowed_updates=["channel_post", "message"])

if __name__ == "__main__":
    main()

