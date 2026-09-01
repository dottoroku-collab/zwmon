import json
import pymongo
from pymongo import MongoClient

# Connect to local port forwarded mongo (assuming ssh -L 27017:127.0.0.1:27017)
# But wait, earlier I used `docker exec zwmon_mongodb mongoimport ...`
