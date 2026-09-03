with open('backend/server.py', 'r') as f:
    server_content = f.read()

new_endpoint = """
@api_router.get("/attendance/route-history")
async def get_route_history(user: dict = Depends(get_current_user)):
    if user.get("role") not in ["admin", "am"]:
        return []

    now = datetime.utcnow()
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    pipeline = [
        {"$match": {"timestamp": {"$gte": start_of_day}}},
        {"$sort": {"timestamp": 1}},
        {"$group": {
            "_id": "$user_id",
            "username": {"$first": "$username"},
            "full_name": {"$first": "$full_name"},
            "route": {
                "$push": {
                    "latitude": "$latitude",
                    "longitude": "$longitude",
                    "timestamp": "$timestamp",
                    "battery_level": "$battery_level",
                    "speed": "$speed"
                }
            }
        }},
        {"$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "id",
            "as": "user_info"
        }},
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {"role": "$user_info.role"}},
        {"$project": {"user_info": 0}}
    ]
    cursor = db.location_logs.aggregate(pipeline)
    routes = await cursor.to_list(length=100)
    
    for r in routes:
        r["user_id"] = r.pop("_id", None)
        
    return routes
"""

if "/attendance/route-history" not in server_content:
    server_content = server_content.replace('    return filtered_locations\n\n@api_router.get("/attendance/history")', '    return filtered_locations\n' + new_endpoint + '\n@api_router.get("/attendance/history")')
    
    with open('backend/server.py', 'w') as f:
        f.write(server_content)
