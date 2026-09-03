import pymongo, os
client = pymongo.MongoClient(os.getenv("MONGO_URL", "mongodb://mongodb:27017"))
db = client[os.getenv("DB_NAME", "zwmon_db")]
print("Users:", [(u["username"], u["role"]) for u in db.users.find()])
print("Chat (global):", db.chats.find_one({"conversation_id": "global"}))
