import logging
import random
import asyncio
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from telegram import Update
from telegram.ext import Application, ContextTypes, MessageHandler, CommandHandler, filters
from telegram import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# --- CONFIG ---
# Бот возьмет токен из переменных окружения Render
BOT_TOKEN = os.getenv("BOT_TOKEN")
SOURCE_CHANNEL_ID = -1002822150379      # канал-источник
DESTINATION_CHAT_ID = -1002503385568    # чат/канал-получатель

# --- Настройка логирования ---
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer

def run_web_server():
    port = int(os.environ.get("PORT", 8000))
    handler = SimpleHTTPRequestHandler
    with TCPServer(("0.0.0.0", port), handler) as httpd:
        logger.info(f"Веб-сервер запущен на порту {port}")
        httpd.serve_forever()

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

    # Проверка на пересылки
    is_forwarded = (
        getattr(post, "forward_origin", None) is not None
        or getattr(post, "forward_from_chat", None) is not None
        or getattr(post, "forward_from", None) is not None
        or getattr(post, "forward_sender_name", None) is not None
        or getattr(post, "forward_date", None) is not None
        or getattr(post, "is_automatic_forward", False)
    )
    if is_forwarded:
        return

    # Проверка на петлю
    if post.via_bot and post.via_bot.id == context.bot.id:
        return

    try:
        if post.media_group_id:  # Если это альбом (несколько фото)
            group_id = post.media_group_id
            if "album_buffer" not in context.bot_data:
                context.bot_data["album_buffer"] = {}

            if group_id not in context.bot_data["album_buffer"]:
                context.bot_data["album_buffer"][group_id] = []
                asyncio.create_task(flush_album(context, group_id))

            context.bot_data["album_buffer"][group_id].append(post)
        else:  # Обычное сообщение
            await context.bot.forward_message(
                chat_id=DESTINATION_CHAT_ID,
                from_chat_id=SOURCE_CHANNEL_ID,
                message_id=post.message_id
            )
    except Exception as e:
        logger.error(f"Ошибка при пересылке: {e}")

# --- Отправка альбома ---
async def flush_album(context: ContextTypes.DEFAULT_TYPE, group_id: str):
    await asyncio.sleep(2)
    msgs = context.bot_data["album_buffer"].pop(group_id, [])
    for msg in msgs:
        try:
            await context.bot.forward_message(
                chat_id=DESTINATION_CHAT_ID,
                from_chat_id=SOURCE_CHANNEL_ID,
                message_id=msg.message_id
            )
        except Exception as e:
            logger.error(f"Ошибка при пересылке альбома: {e}")

# --- Обработка команды /start ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(random.choice(START_REPLIES))

# --- Команда /d20 ---
async def roll_d20(update: Update, context: ContextTypes.DEFAULT_TYPE):
    roll = random.randint(1, 20)

    # Можно добавить немного атмосферы
    if roll == 20:
        text = f"🎲 Ты выбросил {roll} — АХУЕТЬ 20! Критический успех!"
    elif roll == 1:
        text = f"🎲 Ты выбросил {roll} — КРИТИЧЕСКИЙ ПРОВАЛ, ЛОШАРА"
    else:
        text = f"🎲 Ты выбросил {roll}"

    await update.message.reply_text(text)

async def game(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton(
                text="🎮 Играть в Snape Runner",
                web_app=WebAppInfo(url="https://tg-bot-zrol.onrender.com/")
            )
        ]
    ])

    await update.message.reply_text(
        "Запускай игру 👇",
        reply_markup=keyboard
    )


def main():
    threading.Thread(target=run_web_server, daemon=True).start()

    if not BOT_TOKEN:
        logger.error("BOT_TOKEN не найден в переменных окружения!")
        return

    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(MessageHandler(filters.ChatType.CHANNEL, forward_message))
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("d20", roll_d20))
    app.add_handler(CommandHandler("game", game))

    logger.info("Бот запущен...")
    app.run_polling(allowed_updates=["channel_post", "message"])
if __name__ == "__main__":
    main()





