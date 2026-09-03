import requests
import json

try:
    r = requests.post("https://zwmon.com/api/auth/login", data={"username": "admin", "password": "password"})
    if r.status_code != 200:
        # maybe it's OAuth2PasswordRequestForm
        pass
    print("Trying localhost...")
    r = requests.post("http://localhost:8000/api/auth/login", data={"username": "admin", "password": "password"})
    print(r.status_code)
except Exception as e:
    print(e)
