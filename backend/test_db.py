from pymongo import MongoClient
import os

client = MongoClient("mongodb://localhost:27017/")
db = client.zwmon_db

# Check location_logs
locs = list(db.location_logs.find().sort("timestamp", -1).limit(5))
print("LOCATIONS:")
for loc in locs:
    print(f"lat: {loc.get('latitude')}, lng: {loc.get('longitude')}, battery: {loc.get('battery_level')}")

# Check attendance_logs
logs = list(db.attendance_logs.find().sort("timestamp", -1).limit(5))
print("\nATTENDANCE LOGS:")
for log in logs:
    print(f"id: {log.get('_id')}, type: {log.get('type')}, photo: {log.get('photo_url')}")

