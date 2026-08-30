from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import calendar
import jwt
import bcrypt
import base64
import httpx
import io
import json

import asyncio
import time
from fastapi.staticfiles import StaticFiles
import zipfile
import shutil
import openai
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, Flowable, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie

from fastapi import BackgroundTasks
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

# --- KELAS HORIZONTAL LINE ---
class HorizontalLine(Flowable):
    def __init__(self, width, color=colors.black):
        Flowable.__init__(self)
        self.width = width
        self.color = color

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.line(0, 0, self.width, 0)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Folder Uploads
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

app = FastAPI(title="Sistem Tiketing & SLA Control Telkom Makassar")
api_router = APIRouter(prefix="/api")
# Pasang jalur akses statis supaya foto bisa dipanggil via browser
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ WEBSOCKET MANAGER ============
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.role_connections: Dict[str, List[WebSocket]] = {}
        self.user_details: Dict[str, dict] = {} # <-- Tambahkan ini untuk simpan info user

    async def connect(self, websocket: WebSocket, user_id: str, role: str, full_name: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        # Simpan detail user yang lagi online
        self.user_details[user_id] = {
            "full_name": full_name,
            "role": role,
            "last_seen": datetime.now().isoformat()
        }
        
        if role not in self.role_connections:
            self.role_connections[role] = []
        self.role_connections[role].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str, role: str):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [c for c in self.active_connections[user_id] if c != websocket]
            # Kalau koneksinya sudah habis (semua tab ditutup), hapus dari list online
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if user_id in self.user_details:
                    del self.user_details[user_id]
        if role in self.role_connections:
            self.role_connections[role] = [c for c in self.role_connections[role] if c != websocket]
    
    async def send_to_user(self, user_id: str, message: dict):
        for ws in self.active_connections.get(user_id, []):
            try:
                await ws.send_json(message)
            except:
                pass
    
    async def send_to_role(self, role: str, message: dict):
        for ws in self.role_connections.get(role, []):
            try:
                await ws.send_json(message)
            except:
                pass
    
    async def broadcast(self, message: dict):
        for connections in self.active_connections.values():
            for ws in connections:
                try:
                    await ws.send_json(message)
                except:
                    pass

ws_manager = ConnectionManager()

# ============ SERVICE CONFIGURATIONS ============
SERVICE_CONFIG = {
    "cctv": {
        "name": "Jaringan CCTV",
        "total_bandwidth": 4900,  # Mbps
        "total_points": 240,
        "bandwidth_per_point": 10,  # Mbps
        "default_contract": 500000000  # Rp
    },
    "skpd": {
        "name": "Internet Dedicated SKPD",
        "total_bandwidth": 5500,  # Mbps
        "total_points": 0,  # Variable
        "bandwidth_per_point": 0,  # Variable
        "default_contract": 800000000  # Rp
    },
    "ip_speaker": {
        "name": "Internet IP Speaker",
        "total_bandwidth": 500,  # Mbps
        "total_points": 100,
        "bandwidth_per_point": 5,  # Mbps
        "default_contract": 200000000  # Rp
    }
}

# ============ MODELS ============

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "client"
    full_name: str = ""
    phone: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class TicketCreate(BaseModel):
    title: str
    description: str
    service_type: str  # cctv, skpd, ip_speaker
    service_point_id: Optional[str] = None
    location: str
    priority: str = "medium"
    photos: List[str] = []
    initial_indication: str = ""
    created_at: Optional[str] = None

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None

class LogbookPhase1(BaseModel):
    open_ticket_time: str
    initial_indication: str
    photos: List[str] = []

class LogbookPhase2(BaseModel):
    arrival_time: str
    electricity_check: Optional[str] = None
    modem_indicator: Optional[str] = None
    bypass_download: Optional[float] = None
    bypass_upload: Optional[float] = None
    bypass_ping: Optional[float] = None
    photos: List[str] = []

class LogbookPhase3(BaseModel):
    scenario: str
    scenario_detail: str
    photos: List[str] = []

class LogbookPhase4(BaseModel):
    action_taken: str
    category: Optional[str] = None
    photos: List[str] = []

class LogbookPhase5(BaseModel):
    completion_time: str
    final_status: str
    response_time_minutes: Optional[int] = None
    recovery_time_minutes: Optional[int] = None
    total_downtime_minutes: Optional[int] = None
    photos: List[str] = []
    notes: str = ""

class LogbookSubmit(BaseModel):
    ticket_id: str
    phase1: Optional[LogbookPhase1] = None
    phase2: Optional[LogbookPhase2] = None
    phase3: Optional[LogbookPhase3] = None
    phase4: Optional[LogbookPhase4] = None
    phase5: Optional[LogbookPhase5] = None

class ReviewSubmit(BaseModel):
    ticket_id: str
    rating: int
    comment: str

class SettingsUpdate(BaseModel):
    key: str
    value: str

class VerifyRequest(BaseModel):
    comment: str = ""

class RejectRequest(BaseModel):
    comment: str

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    photo: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class ChatMessage(BaseModel):
    to_user_id: str
    message: str

class RestitutionCalc(BaseModel):
    service_type: str
    service_point_id: Optional[str] = None
    bandwidth_affected: float
    downtime_minutes: int
    month: int
    year: int

class ServicePointCreate(BaseModel):
    name: str
    location: str
    address: str
    service_type: str
    bandwidth: float
    ip_address: Optional[str] = None
    coordinates: Optional[str] = None
    cctv_username: Optional[str] = "admin"
    cctv_password: Optional[str] = ""
    cctv_brand: Optional[str] = "hikvision"

class ServicePointUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    bandwidth: Optional[float] = None
    ip_address: Optional[str] = None
    is_active: Optional[bool] = None
    cctv_username: Optional[str] = None
    cctv_password: Optional[str] = None
    cctv_brand: Optional[str] = None

# ============ HELPER FUNCTIONS ============

async def get_local_time(utc_dt_str: str):
    if not utc_dt_str:
        return "-"
    
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8
    
    try:
        dt = datetime.fromisoformat(utc_dt_str.replace('Z', '+00:00'))
        local_dt = dt + timedelta(hours=offset_hours)
        return local_dt.strftime('%d/%m/%Y %H:%M')
    except:
        return utc_dt_str

async def get_now_local():
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8
    return datetime.now(timezone.utc) + timedelta(hours=offset_hours)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def generate_ticket_id(custom_date: str = None) -> str:
    if custom_date:
        try:
            date_part = custom_date[:10].replace('-', '')
        except:
            date_part = datetime.now().strftime('%Y%m%d')
    else:
        date_part = datetime.now().strftime('%Y%m%d')
        
    return f"TKT-{date_part}-{str(uuid.uuid4())[:6].upper()}"

def get_days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]

# --- RUMUS BARU (BULKY VS SATUAN) ---
def calculate_restitution(
    service_type: str,
    downtime_minutes: int,
    bandwidth_affected: float,
    monthly_contract: float,
    month: int,
    year: int
) -> dict:
    days_in_month = get_days_in_month(year, month)
    total_minutes = days_in_month * 24 * 60  # C
    
    allowed_downtime = 0.005 * total_minutes  # Av
    actual_downtime = downtime_minutes  # A
    
    if service_type == "skpd":
        total_bandwidth = SERVICE_CONFIG["skpd"]["total_bandwidth"]
        pro_rata_fee = (bandwidth_affected / total_bandwidth) * monthly_contract
    else:
        bandwidth_per_point = SERVICE_CONFIG.get(service_type, {}).get("bandwidth_per_point", 1)
        biaya_per_titik = monthly_contract 
        pro_rata_fee = (bandwidth_affected / bandwidth_per_point) * biaya_per_titik if bandwidth_per_point > 0 else 0
    
    if actual_downtime <= allowed_downtime:
        restitution = 0
        sla_met = True
    else:
        excess_downtime = actual_downtime - allowed_downtime
        restitution = (excess_downtime / total_minutes) * pro_rata_fee
        sla_met = False
    
    uptime_percentage = ((total_minutes - actual_downtime) / total_minutes) * 100 if total_minutes > 0 else 100
    
    return {
        "total_minutes_in_month": total_minutes,
        "allowed_downtime_minutes": round(allowed_downtime, 2),
        "actual_downtime_minutes": actual_downtime,
        "excess_downtime_minutes": max(0, actual_downtime - allowed_downtime),
        "pro_rata_fee": int(round(pro_rata_fee)), # Dibulatkan
        "uptime_percentage": round(uptime_percentage, 4),
        "sla_target": 99.5,
        "sla_met": sla_met,
        "restitution_amount": int(round(restitution)) # <-- Dibulatkan jadi integer utuh
    }

async def generate_ai_narrative(data: dict) -> dict:
    """Fungsi untuk menyuruh AI menulis narasi PDF ala Konsultan."""
    try:
        client = openai.AsyncOpenAI(api_key=os.environ.get('OPENAI_API_KEY'))
        
        prompt = f"""
Anda adalah Konsultan IT dan Senior Data Analyst di PT Telkom. Tugas Anda membuat Laporan Evaluasi SLA yang sangat formal, mendalam, dan komprehensif dalam bahasa Indonesia.

Gunakan data faktual berikut:
- Periode: {data['period']}
- Total Tiket Gangguan: {data['total_tickets']}
- Gangguan Sisi Telkom (Skenario A): {data['scenario_a']} tiket, downtime {data['downtime_a']} menit
- Gangguan Sisi Pelanggan (Skenario B): {data['scenario_b']} tiket, downtime {data['downtime_b']} menit
- Rata-rata Uptime Telkom (Skenario A): {data['uptime']}% (Target SLA: 99.5%)
- Total Estimasi Restitusi (Hukuman Pinalti): Rp {data['restitution']}

ATURAN PENULISAN:
1. Buat dua bagian teks, pisahkan dengan tag persis seperti ini: ===RINGKASAN=== dan ===KESIMPULAN===
2. Di bawah ===RINGKASAN===, tulis 3 paragraf ringkasan eksekutif, deskripsikan perbandingan gangguan Telkom vs Pelanggan, dan sebutkan total tiket.
3. Di bawah ===KESIMPULAN===, tulis 5-6 paragraf analisis mendalam. Analisis apakah SLA terpenuhi atau tidak, jika SLA tidak terpenuhiapa dampak dari Gangguan dari sisi Pelanggan yang sering mati lampu/rusak perangkat, jelaskan soal restitusi, dan berikan rekomendasi aksi teknis (Preventive Maintenance).
4. Gunakan bahasa korporat yang elegan. Pisahkan antar paragraf dengan dua kali enter (baris baru). Jangan gunakan format Markdown (seperti ** atau #), gunakan teks biasa saja.
"""
        response = await client.chat.completions.create(
            model="gpt-4o", # Bisa diganti ke gpt-4o kalau mau lebih pintar lagi
            messages=[
                {"role": "system", "content": "Anda adalah Senior Data Analyst yang objektif dan analitis."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3 # Suhu rendah supaya bahasanya kaku dan formal ala laporan BUMN
        )
        
        ai_text = response.choices[0].message.content
        
        # Ekstrak teks berdasarkan tag
        parts = ai_text.split("===KESIMPULAN===")
        ringkasan_raw = parts[0].replace("===RINGKASAN===", "").strip()
        kesimpulan_raw = parts[1].strip() if len(parts) > 1 else "Analisis kesimpulan gagal dimuat AI."
        
        return {
            "ringkasan": ringkasan_raw,
            "kesimpulan": kesimpulan_raw
        }
        
    except Exception as e:
        logger.error(f"Gagal generate AI Narrative: {e}")
        return {
            "ringkasan": "Data Ringkasan gagal di-generate oleh AI karena gangguan server/API.",
            "kesimpulan": "Data Kesimpulan gagal di-generate oleh AI karena gangguan server/API."
        }

async def send_telegram_notification(message: str, chat_ids: List[str] = None):
    try:
        settings = await db.settings.find_one({"key": "telegram_token"}, {"_id": 0})
        if not settings or not settings.get('value'):
            return
        
        token = settings['value']
        
        if not chat_ids:
            chat_settings = await db.settings.find_one({"key": "telegram_chat_ids"}, {"_id": 0})
            if chat_settings and chat_settings.get('value'):
                chat_ids = chat_settings['value'].split(',')
            else:
                return
        
        async with httpx.AsyncClient() as http_client:
            for chat_id in chat_ids:
                chat_id = chat_id.strip()
                if chat_id:
                    url = f"https://api.telegram.org/bot{token}/sendMessage"
                    await http_client.post(url, json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": "HTML"
                    })
    except Exception as e:
        logger.error(f"Telegram notification error: {e}")

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"$or": [{"email": user.email}, {"username": user.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email atau username sudah terdaftar")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": user.username,
        "email": user.email,
        "password": hash_password(user.password),
        "role": "client",
        "full_name": user.full_name,
        "phone": user.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, "client")
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user.username,
            "email": user.email,
            "role": "client",
            "full_name": user.full_name
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Email atau password salah")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=401, detail="Akun tidak aktif")
    
    token = create_token(user['id'], user['role'])
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
            "role": user['role'],
            "full_name": user.get('full_name', '')
        }
    }

@api_router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in ["jpg", "jpeg", "png"]:
            raise HTTPException(status_code=400, detail="Hanya file gambar (jpg, png) yang diizinkan")

        file_name = f"{uuid.uuid4()}.{file_ext}"
        file_path = UPLOAD_DIR / file_name

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        return {"photo_url": f"https://zwmon.com/uploads/{file_name}"}
        
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan foto")

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user['id'],
        "username": user['username'],
        "email": user['email'],
        "role": user['role'],
        "full_name": user.get('full_name', ''),
        "phone": user.get('phone', ''),
        "photo": user.get('photo', '')
    }

# ============ PROFILE ============

@api_router.put("/auth/profile")
async def update_profile(update: ProfileUpdate, user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah")
    
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"id": user['id']}, {"$set": update_dict})
    
    updated = await db.users.find_one({"id": user['id']}, {"_id": 0, "password": 0})
    return {
        "message": "Profil berhasil diupdate",
        "user": {
            "id": updated['id'],
            "username": updated['username'],
            "email": updated['email'],
            "role": updated['role'],
            "full_name": updated.get('full_name', ''),
            "phone": updated.get('phone', ''),
            "photo": updated.get('photo', '')
        }
    }

@api_router.put("/auth/password")
async def change_password(req: PasswordChange, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"id": user['id']})
    if not full_user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    if not bcrypt.checkpw(req.current_password.encode('utf-8'), full_user['password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Password lama salah")
    
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter")
    
    hashed = bcrypt.hashpw(req.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one({"id": user['id']}, {"$set": {"password": hashed}})
    
    return {"message": "Password berhasil diubah"}

# ============ SETTINGS WITH LOGO/NAME ============

@api_router.get("/settings/site")
async def get_site_settings():
    settings = {}
    for key in ['site_name', 'site_logo']:
        doc = await db.settings.find_one({"key": key}, {"_id": 0})
        if doc:
            settings[key] = doc['value']
    return {
        "site_name": settings.get('site_name', 'Sistem Tiketing & SLA Control Telkom Makassar'),
        "site_logo": settings.get('site_logo', '')
    }

@api_router.put("/settings/site")
async def update_site_settings(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengubah pengaturan")
    return {"message": "Gunakan endpoint /api/settings"}

# ============ CHAT ============

@api_router.post("/chat/send")
async def send_chat(msg: ChatMessage, user: dict = Depends(get_current_user)):
    to_user = await db.users.find_one({"id": msg.to_user_id}, {"_id": 0, "password": 0})
    if not to_user:
        raise HTTPException(status_code=404, detail="User tujuan tidak ditemukan")
    
    if to_user['role'] == 'admin' and user['role'] != 'am':
        raise HTTPException(status_code=403, detail="Hanya AM yang dapat mengirim pesan ke Admin")
    
    participants = sorted([user['id'], msg.to_user_id])
    conversation_id = f"{participants[0]}_{participants[1]}"
    
    chat_doc = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "from_id": user['id'],
        "from_name": user.get('full_name', user['username']),
        "from_role": user['role'],
        "to_id": msg.to_user_id,
        "to_name": to_user.get('full_name', to_user['username']),
        "message": msg.message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.chats.insert_one(chat_doc)

    asyncio.create_task(ws_manager.send_to_user(msg.to_user_id, {
        "type": "chat_message",
        "from_name": user.get('full_name', user['username']),
        "message": msg.message
    }))

    return {"message": "Pesan berhasil dikirim", "chat_id": chat_doc['id']}

@api_router.get("/chat/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    chats = await db.chats.find(
        {"$or": [{"from_id": user['id']}, {"to_id": user['id']}]},
        {"_id": 0, "id": 1, "conversation_id": 1, "from_id": 1, "to_id": 1, "from_name": 1, "to_name": 1, "from_role": 1, "to_role": 1, "message": 1, "created_at": 1, "read": 1}
    ).sort("created_at", -1).to_list(500)
    
    convos = {}
    for c in chats:
        cid = c['conversation_id']
        if cid not in convos:
            other_id = c['to_id'] if c['from_id'] == user['id'] else c['from_id']
            other_name = c['to_name'] if c['from_id'] == user['id'] else c['from_name']
            other_role = c.get('to_role', '') if c['from_id'] == user['id'] else c.get('from_role', '')
            unread = sum(1 for m in chats if m['conversation_id'] == cid and m['to_id'] == user['id'] and not m.get('read'))
            convos[cid] = {
                "conversation_id": cid,
                "other_user_id": other_id,
                "other_user_name": other_name,
                "other_user_role": other_role,
                "last_message": c['message'][:100],
                "last_message_at": c['created_at'],
                "unread_count": unread
            }
    
    return {"conversations": list(convos.values())}

@api_router.get("/chat/messages/{other_user_id}")
async def get_chat_messages(other_user_id: str, user: dict = Depends(get_current_user)):
    participants = sorted([user['id'], other_user_id])
    conversation_id = f"{participants[0]}_{participants[1]}"
    
    messages = await db.chats.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    await db.chats.update_many(
        {"conversation_id": conversation_id, "to_id": user['id'], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"messages": messages}

@api_router.get("/chat/users")
async def get_chat_users(user: dict = Depends(get_current_user)):
    if user['role'] == 'am':
        users = await db.users.find(
            {"id": {"$ne": user['id']}, "is_active": True},
            {"_id": 0, "password": 0}
        ).to_list(100)
    elif user['role'] == 'admin':
        users = await db.users.find(
            {"role": "am", "id": {"$ne": user['id']}, "is_active": True},
            {"_id": 0, "password": 0}
        ).to_list(100)
    else:
        users = await db.users.find(
            {"role": {"$in": ["am", "helpdesk"]}, "id": {"$ne": user['id']}, "is_active": True},
            {"_id": 0, "password": 0}
        ).to_list(100)
    
    return {"users": users}

@api_router.delete("/chat/conversations/{other_user_id}")
async def delete_conversation(other_user_id: str, user: dict = Depends(get_current_user)):
    participants = sorted([user['id'], other_user_id])
    conversation_id = f"{participants[0]}_{participants[1]}"
    
    result = await db.chats.delete_many({"conversation_id": conversation_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Percakapan tidak ditemukan atau sudah dihapus")
        
    return {"message": "Percakapan berhasil dimusnahkan"}

# ============ USER MANAGEMENT ROUTES ============

@api_router.get("/users")
async def get_users(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengakses")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(200)
    return {"users": users}

@api_router.post("/users")
async def create_user(new_user: UserCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat menambah user")
    
    existing = await db.users.find_one({"$or": [{"email": new_user.email}, {"username": new_user.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email atau username sudah terdaftar")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "username": new_user.username,
        "email": new_user.email,
        "password": hash_password(new_user.password),
        "role": new_user.role,
        "full_name": new_user.full_name,
        "phone": new_user.phone,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    return {"message": "User berhasil dibuat", "user_id": user_id}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update: UserUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengubah user")
    
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    return {"message": "User berhasil diupdate"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat menghapus user")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    return {"message": "User berhasil dihapus"}

@api_router.get("/users/eos")
async def get_eos_users(user: dict = Depends(get_current_user)):
    if user['role'] not in ['admin', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    eos_users = await db.users.find({"role": "eos", "is_active": True}, {"_id": 0, "password": 0}).to_list(100)
    return {"users": eos_users}

# ============ SERVICE POINTS ============

@api_router.get("/service-points")
async def get_service_points(service_type: str = None, user: dict = Depends(get_current_user)):
    query = {}
    if service_type:
        query['service_type'] = service_type
    
    points = await db.service_points.find(query, {"_id": 0}).to_list(1000)
    return {"points": points}

@api_router.post("/service-points")
async def create_service_point(point: ServicePointCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat menambah titik layanan")
    
    point_id = str(uuid.uuid4())
    point_doc = {
        "id": point_id,
        "name": point.name,
        "location": point.location,
        "address": point.address,
        "service_type": point.service_type,
        "bandwidth": point.bandwidth,
        "ip_address": point.ip_address,
        "coordinates": point.coordinates,
        "cctv_username": point.cctv_username,
        "cctv_password": point.cctv_password,
        "cctv_brand": point.cctv_brand,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.service_points.insert_one(point_doc)
    return {"message": "Titik layanan berhasil ditambahkan", "point_id": point_id}

@api_router.put("/service-points/{point_id}")
async def update_service_point(point_id: str, update: ServicePointUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengubah titik layanan")
    
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diubah")
    
    result = await db.service_points.update_one({"id": point_id}, {"$set": update_dict})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Titik layanan tidak ditemukan")
    
    return {"message": "Titik layanan berhasil diupdate"}

@api_router.delete("/service-points/{point_id}")
async def delete_service_point(point_id: str, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat menghapus titik layanan")
    
    result = await db.service_points.delete_one({"id": point_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Titik layanan tidak ditemukan")
    
    return {"message": "Titik layanan berhasil dihapus"}

# ============ TICKET ROUTES ============

@api_router.post("/tickets")
async def create_ticket(ticket: TicketCreate, user: dict = Depends(get_current_user)):
    if user['role'] not in ['client', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Hanya client atau helpdesk yang dapat membuat tiket")
    
    custom_date = getattr(ticket, 'created_at', None)
    if custom_date:
        created_at = custom_date
    else:
        now_wita = await get_now_local()
        created_at = now_wita.isoformat()

    ticket_id = generate_ticket_id(created_at)
    created_at_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))

    service_point = None
    bandwidth = 0
    if ticket.service_point_id:
        service_point = await db.service_points.find_one({"id": ticket.service_point_id}, {"_id": 0})
        if service_point:
            bandwidth = service_point.get('bandwidth', 0)
    
    ticket_doc = {
        "id": ticket_id,
        "created_at": created_at,
        "updated_at": created_at,
        "status": "open",
        "title": ticket.title,
        "description": ticket.description,
        "service_type": ticket.service_type,
        "service_point_id": ticket.service_point_id,
        "service_point_name": service_point.get('name') if service_point else None,
        "bandwidth": bandwidth,
        "location": ticket.location,
        "priority": ticket.priority,
        "initial_indication": ticket.initial_indication,
        "client_id": user['id'],
        "client_name": user.get('full_name', user['username']),
        "assigned_to": None,
        "assigned_name": None,
        "photos": ticket.photos,
        "logbook": {
            "phase1": {
                "open_ticket_time": created_at,
                "initial_indication": ticket.initial_indication,
                "photos": ticket.photos
            }
        },
        "review": None,
        "am_verified": False,
        "scenario": None,
        "final_status": None,
        "arrival_time": None,
        "completion_time": None,
        "closed_at": None,
        "total_downtime_minutes": None,
        "sla_deadline": (created_at_dt + timedelta(hours=4)).isoformat(),
        "status_history": [{
            "from_status": "new",
            "to_status": "open",
            "by": user['id'],
            "by_name": user.get('full_name', user['username']),
            "role": user['role'],
            "comment": "Tiket dibuat",
            "at": created_at
        }]
    }
    
    await db.tickets.insert_one(ticket_doc)
    
    service_names = {"cctv": "CCTV", "skpd": "Internet SKPD", "ip_speaker": "IP Speaker"}
    await send_telegram_notification(
        f"🆕 <b>Tiket Baru!</b>\n"
        f"ID: {ticket_id}\n"
        f"Layanan: {service_names.get(ticket.service_type, ticket.service_type)}\n"
        f"Prioritas: {ticket.priority.upper()}\n"
        f"Lokasi: {ticket.location}\n"
        f"Indikasi: {ticket.initial_indication}\n"
        f"Deskripsi: {ticket.description[:100]}..."
    )
    
    asyncio.create_task(_ws_notify_ticket(ticket_id, "ticket_created", {
        "title": ticket.title, "service_type": ticket.service_type, "priority": ticket.priority
    }))
    
    return {"message": "Tiket berhasil dibuat", "ticket_id": ticket_id}

async def _ws_notify_ticket(ticket_id: str, event: str, extra: dict = None):
    msg = {"type": "ticket_update", "event": event, "ticket_id": ticket_id, "at": datetime.now(timezone.utc).isoformat()}
    if extra:
        msg.update(extra)
    await ws_manager.send_to_role("admin", msg)
    await ws_manager.send_to_role("am", msg)
    await ws_manager.send_to_role("helpdesk", msg)
    if extra and extra.get("notify_user"):
        await ws_manager.send_to_user(extra["notify_user"], msg)

@api_router.get("/tickets")
async def get_tickets(service_type: str = None, user: dict = Depends(get_current_user)):
    query = {}
    
    if user['role'] == 'client':
        query['client_id'] = user['id']
    elif user['role'] == 'eos':
        query['assigned_to'] = user['id']
    elif user['role'] == 'am':
        pass
    
    if service_type:
        query['service_type'] = service_type
    
    projection = {
        "_id": 0, 
        "logbook": 0, 
        "photos": 0, 
        "status_history": 0, 
        "am_messages": 0
    }
    tickets = await db.tickets.find(query, projection).sort("created_at", -1).to_list(1000)
    return {"tickets": tickets}

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    return {"ticket": ticket}

# ================= TAMBAHAN BAPG / SERVICE REPORT PDF =================
@api_router.get("/tickets/{ticket_id}/pdf")
async def generate_ticket_pdf(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
        
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=20*mm, bottomMargin=20*mm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Heading1'], fontSize=14, spaceAfter=6, alignment=1) # Center
    subtitle_style = ParagraphStyle('Subtitle2', parent=styles['Heading2'], fontSize=11, spaceAfter=10, alignment=1)
    normal_style = ParagraphStyle('Normal2', parent=styles['Normal'], fontSize=9, leading=12)
    bold_style = ParagraphStyle('Bold2', parent=styles['Normal'], fontSize=9, leading=12, fontName='Helvetica-Bold')
    
    elements = []
    
    def safe_str(val, default="-"):
        return str(val) if val is not None and str(val).strip() != "" else default

    # 1. KOP SURAT
    logo_path = ROOT_DIR / "telkom_logo.png"
    header_right = ""
    if logo_path.exists():
        header_right = Image(str(logo_path), width=25*mm, height=17.7*mm)
        
    header_text = [
        Paragraph("<b>PT TELEKOMUNIKASI INDONESIA Tbk</b>", bold_style),
        Paragraph("Regional V Witel Sulbagsel", normal_style)
    ]
    
    header_table = Table([[header_text, header_right]], colWidths=[140*mm, 40*mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(HorizontalLine(510, colors.black))
    elements.append(Spacer(1, 8*mm))
    
    # 2. JUDUL BAPG
    elements.append(Paragraph("BERITA ACARA PENYELESAIAN GANGGUAN (SERVICE REPORT)", title_style))
    elements.append(Paragraph(f"Nomor Tiket: {safe_str(ticket.get('id'))}", subtitle_style))
    elements.append(Spacer(1, 5*mm))
    
    # 3. INFORMASI GANGGUAN (FASE 1)
    elements.append(Paragraph("<b>A. INFORMASI GANGGUAN</b>", bold_style))
    elements.append(Spacer(1, 2*mm))
    
    created_at = await get_local_time(ticket.get('created_at', ''))
    
    data_a = [
        ["Waktu Pelaporan", ":", created_at],
        ["Pelapor", ":", safe_str(ticket.get('client_name'))],
        ["Layanan", ":", safe_str(ticket.get('service_type')).upper()],
        ["Lokasi / Titik", ":", safe_str(ticket.get('location'))],
        ["Indikasi Awal", ":", safe_str(ticket.get('initial_indication'))],
        ["Deskripsi Singkat", ":", Paragraph(safe_str(ticket.get('description')), normal_style)],
    ]
    
    table_a = Table(data_a, colWidths=[40*mm, 5*mm, 135*mm])
    table_a.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(table_a)
    elements.append(Spacer(1, 5*mm))
    
    # 4. TINDAKAN PENYELESAIAN (LOGBOOK)
    elements.append(Paragraph("<b>B. TINDAKAN PENYELESAIAN (LOGBOOK TEKNISI)</b>", bold_style))
    elements.append(Spacer(1, 2*mm))
    
    logbook = ticket.get('logbook') or {}
    phase3 = logbook.get('phase3') or {}
    phase4 = logbook.get('phase4') or {}
    phase5 = logbook.get('phase5') or {}
    
    arrival_time = await get_local_time(ticket.get('arrival_time')) if ticket.get('arrival_time') else "-"
    completion_time = await get_local_time(ticket.get('completion_time')) if ticket.get('completion_time') else "-"
    
    skenario_val = ticket.get('scenario')
    if skenario_val:
        skenario_text = f"Skenario {skenario_val} ({safe_str(phase3.get('scenario_detail'))})"
    else:
        skenario_text = "Belum Diklasifikasi"
    
    data_b = [
        ["Waktu Tiba Teknisi", ":", arrival_time],
        ["Teknisi Bertugas", ":", safe_str(ticket.get('assigned_name'))],
        ["Klasifikasi Gangguan", ":", Paragraph(skenario_text, normal_style)],
        ["Tindakan Perbaikan", ":", Paragraph(safe_str(phase4.get('action_taken')), normal_style)],
        ["Waktu Selesai (UP)", ":", completion_time],
        ["Total Downtime", ":", f"{safe_str(ticket.get('total_downtime_minutes'))} Menit"],
        ["Status Akhir", ":", safe_str(phase5.get('final_status')).replace('_', ' ').title()],
    ]
    
    table_b = Table(data_b, colWidths=[40*mm, 5*mm, 135*mm])
    table_b.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(table_b)
    elements.append(Spacer(1, 10*mm))
    
    # 5. TANDA TANGAN
    elements.append(Paragraph("Demikian Berita Acara ini dibuat dengan sebenarnya sesuai SOP untuk dapat dipergunakan sebagaimana mestinya.", normal_style))
    elements.append(Spacer(1, 15*mm))
    
    sign_data = [
        ["Mengetahui,", "Dikerjakan Oleh,"],
        ["Account Manager Telkom", "Teknisi Lapangan (EOS)"],
        ["", ""],
        ["", ""],
        ["", ""],
        ["( Wulan Setya Ningsih )", f"( {safe_str(ticket.get('assigned_name'), '..........................')} )"]
    ]
    
    sign_table = Table(sign_data, colWidths=[90*mm, 90*mm])
    sign_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(sign_table)
    
    # ================= 6. LAMPIRAN LOGBOOK & FOTO (HALAMAN BARU) =================
    elements.append(PageBreak())
    elements.append(Paragraph("<b>LAMPIRAN: DETAIL LOGBOOK & DOKUMENTASI</b>", title_style))
    elements.append(Spacer(1, 5*mm))
    
    # Fungsi bantu untuk susun foto jadi tabel 2 kolom
    def get_logbook_photos(photo_urls):
        if not photo_urls:
            return Paragraph("<i>Tidak ada dokumentasi foto.</i>", ParagraphStyle('Italic', parent=styles['Normal'], fontSize=8, textColor=colors.grey))
            
        img_elements = []
        for url in photo_urls:
            try:
                # Ambil nama file asli dari ujung URL supaya aman ditarik dari folder UPLOAD_DIR
                filename = url.split('/')[-1]
                local_path = UPLOAD_DIR / filename
                if local_path.exists():
                    img = Image(str(local_path))
                    # Resize supaya pas masuk kertas A4
                    ratio = img.imageHeight / img.imageWidth
                    img.drawWidth = 75 * mm
                    img.drawHeight = 75 * mm * ratio
                    img_elements.append(img)
            except:
                pass
                
        if not img_elements:
            return Paragraph("<i>Foto tidak ditemukan di server.</i>", normal_style)
            
        # Susun foto jadi 2 per baris
        rows = []
        for i in range(0, len(img_elements), 2):
            row = img_elements[i:i+2]
            if len(row) == 1:
                row.append("") # Biar tidak error kalau fotonya ganjil
            rows.append(row)
            
        table = Table(rows, colWidths=[85*mm, 85*mm])
        table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        return table

    # Daftar Fase Logbook yang mau diprint ke PDF
    phases_config = [
        ("Fase 1: Tiket Dibuka & Indikasi Awal", "phase1"),
        ("Fase 2: Kedatangan & Pengecekan Fisik", "phase2"),
        ("Fase 3: Analisis & Skenario Gangguan", "phase3"),
        ("Fase 4: Tindakan Perbaikan", "phase4"),
        ("Fase 5: Penyelesaian & Finalisasi", "phase5")
    ]
    
    for title, phase_key in phases_config:
        phase_data = logbook.get(phase_key)
        if not phase_data:
            continue # Skip kalau teknisi belum isi fase ini
            
        # Print Judul Fase (Warna Merah Telkom sedikit biar cakep)
        elements.append(Paragraph(f"<b>{title}</b>", ParagraphStyle('Sub2', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor("#E3242B"), spaceAfter=5)))
        
        # Susun Data Teks (kecuali foto)
        text_data = []
        for k, v in phase_data.items():
            if k == 'photos': continue
            key_label = str(k).replace('_', ' ').title()
            val_label = safe_str(v)
            text_data.append([key_label, ":", Paragraph(val_label, normal_style)])
            
        if text_data:
            detail_table = Table(text_data, colWidths=[40*mm, 5*mm, 125*mm])
            detail_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(detail_table)
            elements.append(Spacer(1, 3*mm))
            
        # Print Foto
        photos = phase_data.get('photos', [])
        elements.append(get_logbook_photos(photos))
        
        elements.append(Spacer(1, 5*mm))
        elements.append(HorizontalLine(510, colors.lightgrey))
        elements.append(Spacer(1, 5*mm))

    try:
        doc.build(elements)
    except Exception as e:
        logger.error(f"Gagal build PDF BAPG: {e}")
        raise HTTPException(status_code=500, detail="Gagal membuat PDF: Error saat merender isi")
        
    buffer.seek(0)
    filename = f"BAPG_{ticket['id']}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@api_router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    if user['role'] not in ['admin', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Hanya Admin yang bisa hapus tiket, Boska!")

    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")

    result = await db.tickets.delete_one({"id": ticket_id})
    
    if result.deleted_count > 0:
        logger.info(f"Tiket {ticket_id} berhasil dihapus oleh {user['username']}")
        return {"message": f"Tiket {ticket_id} berhasil dimusnahkan!"}
    
    raise HTTPException(status_code=500, detail="Gagal hapus tiket dari database")

@api_router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, update: TicketUpdate, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    return {"message": "Tiket berhasil diupdate"}

@api_router.post("/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, eos_user_id: str, user: dict = Depends(get_current_user)):
    if user['role'] not in ['admin', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Hanya helpdesk yang dapat menugaskan tiket")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    eos_user = await db.users.find_one({"id": eos_user_id, "role": "eos"}, {"_id": 0})
    if not eos_user:
        raise HTTPException(status_code=404, detail="EOS user tidak ditemukan")
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$set": {
                "assigned_to": eos_user_id,
                "assigned_name": eos_user.get('full_name', eos_user['username']),
                "status": "assigned",
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {
                "status_history": {
                    "from_status": ticket.get('status', 'open'),
                    "to_status": "assigned",
                    "by": user['id'],
                    "by_name": user.get('full_name', user['username']),
                    "role": user['role'],
                    "comment": f"Ditugaskan ke {eos_user.get('full_name', eos_user['username'])}",
                    "at": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    await send_telegram_notification(
        f"📋 <b>Tiket Ditugaskan!</b>\n"
        f"ID: {ticket_id}\n"
        f"Ditugaskan ke: {eos_user.get('full_name', eos_user['username'])}\n"
        f"Judul: {ticket['title']}"
    )
    
    asyncio.create_task(_ws_notify_ticket(ticket_id, "ticket_assigned", {"notify_user": eos_user_id}))
    return {"message": "Tiket berhasil ditugaskan"}

# ============ LOGBOOK ROUTES ============

@api_router.post("/logbook")
async def submit_logbook(logbook: LogbookSubmit, user: dict = Depends(get_current_user)):
    if user['role'] != 'eos':
        raise HTTPException(status_code=403, detail="Hanya EOS yang dapat mengisi logbook")
    
    ticket = await db.tickets.find_one({"id": logbook.ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    if ticket['assigned_to'] != user['id']:
        raise HTTPException(status_code=403, detail="Tiket ini tidak ditugaskan kepada Anda")
    
    now_iso = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": now_iso}
    
    new_status = None
    logbook_time = now_iso
    logbook_message = ""
    
    if logbook.phase2:
        update_data["logbook.phase2"] = logbook.phase2.model_dump()
        update_data["arrival_time"] = logbook.phase2.arrival_time 
        logbook_time = logbook.phase2.arrival_time
        new_status = "in_progress"
        logbook_message = "Logbook fase 2 (Investigasi) dimulai"
    
    if logbook.phase3:
        update_data["logbook.phase3"] = logbook.phase3.model_dump()
        update_data["scenario"] = logbook.phase3.scenario
        logbook_message = "Skenario gangguan diklasifikasi"
    
    if logbook.phase4:
        update_data["logbook.phase4"] = logbook.phase4.model_dump()
        logbook_message = "Tindakan perbaikan diinput"
    
    if logbook.phase5:
        completion_dt = datetime.fromisoformat(logbook.phase5.completion_time.replace('Z', '+00:00'))
        created_dt = datetime.fromisoformat(ticket['created_at'].replace('Z', '+00:00'))
        auto_downtime = int(max(0, (completion_dt - created_dt).total_seconds() / 60))
        logbook_dict = logbook.phase5.model_dump()
        logbook_dict['total_downtime_minutes'] = auto_downtime
        update_data["logbook.phase5"] = logbook_dict
        update_data["completion_time"] = logbook.phase5.completion_time
        logbook_time = logbook.phase5.completion_time
        update_data["final_status"] = logbook.phase5.final_status
        update_data["total_downtime_minutes"] = auto_downtime
        
        if logbook.phase5.final_status == "escalation_core":
            new_status = "escalated"
        else:
            new_status = "pending_verification"
        
        logbook_message = "Logbook fase 5 (Penyelesaian) selesai"

    if new_status:
        update_data["status"] = new_status
        
    await db.tickets.update_one({"id": logbook.ticket_id}, {"$set": update_data})
    
    if new_status:
        await db.tickets.update_one(
            {"id": logbook.ticket_id},
            {"$push": {"status_history": {
                "from_status": ticket.get('status'),
                "to_status": new_status,
                "by": user['id'],
                "by_name": user.get('full_name', user['username']),
                "role": "eos",
                "comment": logbook_message,
                "at": logbook_time 
            }}}
        )
    
    if logbook.phase5:
        status_labels = {
            "normal_user": "Normal di Sisi Pengguna",
            "normal_telkom_pending": "Normal Sisi Telkom (Pending Kominfo)",
            "escalation_core": "Eskalasi Tim Core"
        }
        await send_telegram_notification(
            f"✅ <b>Logbook Selesai!</b>\n"
            f"ID: {logbook.ticket_id}\n"
            f"Status: {status_labels.get(logbook.phase5.final_status, logbook.phase5.final_status)}\n"
            f"Skenario: {ticket.get('scenario', '-')}"
        )
    
    asyncio.create_task(_ws_notify_ticket(logbook.ticket_id, "logbook_updated", {"notify_user": ticket.get("client_id")}))
    return {"message": "Logbook berhasil disimpan"}

@api_router.get("/logbook/{ticket_id}")
async def get_logbook(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    return {"logbook": ticket.get('logbook')}

# ============ REVIEW ROUTES ============

@api_router.post("/review")
async def submit_review(review: ReviewSubmit, user: dict = Depends(get_current_user)):
    if user['role'] != 'client':
        raise HTTPException(status_code=403, detail="Hanya client yang dapat memberikan review")
    
    ticket = await db.tickets.find_one({"id": review.ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    if ticket['client_id'] != user['id']:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke tiket ini")
    
    review_doc = {
        "rating": review.rating,
        "comment": review.comment,
        "client_id": user['id'],
        "client_name": user.get('full_name', user['username']),
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tickets.update_one(
        {"id": review.ticket_id},
        {"$set": {
            "review": review_doc,
            "status": "pending_verification",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await send_telegram_notification(
        f"⭐ <b>Review Masuk!</b>\n"
        f"ID: {review.ticket_id}\n"
        f"Rating: {'⭐' * review.rating}\n"
        f"Silakan verifikasi untuk menutup tiket."
    )
    
    return {"message": "Review berhasil disimpan"}

# ============ AM VERIFICATION ============

@api_router.post("/tickets/{ticket_id}/verify")
async def verify_ticket(ticket_id: str, req: VerifyRequest = None, user: dict = Depends(get_current_user)):
    if user['role'] not in ['am', 'admin']:
        raise HTTPException(status_code=403, detail="Hanya AM dan Admin yang dapat memverifikasi tiket")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    # Ambil waktu penyelesaian dari teknisi (EOS)
    # Jika teknisi lupa isi, baru fallback ke waktu sekarang
    eos_completion_time = ticket.get('completion_time') or datetime.now(timezone.utc).isoformat()
    
    comment = req.comment if req else ""
    now_verify = datetime.now(timezone.utc).isoformat()
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$set": {
                "am_verified": True,
                "am_verified_by": user['id'],
                "am_verified_at": now_verify,
                "am_comment": comment,
                "status": "closed",
                "closed_at": eos_completion_time, # <-- SEKARANG PAKAI WAKTU EOS
                "updated_at": now_verify
            },
            "$push": {
                "status_history": {
                    "from_status": "pending_verification",
                    "to_status": "closed",
                    "by": user['id'],
                    "by_name": user.get('full_name', user['username']),
                    "role": "am",
                    "comment": comment or "Tiket diverifikasi (Waktu selesai mengikuti data EOS)",
                    "at": now_verify
                }
            }
        }
    )
    
    asyncio.create_task(_ws_notify_ticket(ticket_id, "ticket_verified", {"notify_user": ticket.get("client_id")}))
    return {"message": "Tiket berhasil diverifikasi dan ditutup"}

@api_router.post("/tickets/{ticket_id}/reject")
async def reject_ticket(ticket_id: str, req: RejectRequest, user: dict = Depends(get_current_user)):
    if user['role'] not in ['am', 'admin']:
        raise HTTPException(status_code=403, detail="Hanya AM dan Admin yang dapat menolak tiket")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    if ticket.get('status') != 'pending_verification':
        raise HTTPException(status_code=400, detail="Tiket tidak dalam status menunggu verifikasi")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$set": {
                "status": "in_progress",
                "am_rejected": True,
                "am_reject_comment": req.comment,
                "am_rejected_at": now,
                "updated_at": now,
                "logbook.phase5": None,
                "completion_time": None,
                "final_status": None,
                "total_downtime_minutes": None,
            },
            "$push": {
                "status_history": {
                    "from_status": "pending_verification",
                    "to_status": "in_progress",
                    "by": user['id'],
                    "by_name": user.get('full_name', user['username']),
                    "role": "am",
                    "comment": req.comment,
                    "at": now
                }
            }
        }
    )
    
    await send_telegram_notification(
        f"🔙 <b>Tiket Ditolak AM!</b>\n"
        f"ID: {ticket_id}\n"
        f"Alasan: {req.comment[:200]}\n"
        f"Dikembalikan ke EOS untuk dilengkapi."
    )
    
    asyncio.create_task(_ws_notify_ticket(ticket_id, "ticket_rejected", {"notify_user": ticket.get("assigned_to")}))
    return {"message": "Tiket ditolak dan dikembalikan ke EOS"}

class AMMessage(BaseModel):
    message: str

@api_router.post("/tickets/{ticket_id}/message")
async def send_am_message(ticket_id: str, msg: AMMessage, user: dict = Depends(get_current_user)):
    if user['role'] != 'am':
        raise HTTPException(status_code=403, detail="Hanya AM yang dapat mengirim pesan")
    
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")
    
    message_doc = {
        "from": user['id'],
        "from_name": user.get('full_name', user['username']),
        "message": msg.message,
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tickets.update_one(
        {"id": ticket_id},
        {
            "$push": {"am_messages": message_doc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    await send_telegram_notification(
        f"💬 <b>Pesan AM!</b>\n"
        f"ID: {ticket_id}\n"
        f"Dari: {user.get('full_name', user['username'])}\n"
        f"Pesan: {msg.message[:200]}"
    )
    return {"message": "Pesan berhasil dikirim"}

# ============ SETTINGS ROUTES ============

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengakses settings")
    
    settings = await db.settings.find({}, {"_id": 0}).to_list(100)
    return {"settings": {s['key']: s['value'] for s in settings}}

@api_router.post("/settings")
async def update_settings(setting: SettingsUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat mengubah settings")
    
    await db.settings.update_one(
        {"key": setting.key},
        {"$set": {"key": setting.key, "value": setting.value}},
        upsert=True
    )
    return {"message": "Setting berhasil disimpan"}

# --- FUNGSI BANTUAN UNTUK AMBIL & RESTORE SEMUA DATA ---
async def _get_full_db_dump():
    collections = ["users", "service_points", "tickets", "settings", "chats", "ping_results"]
    data = {}
    for coll in collections:
        cursor = db[coll].find({}, {"_id": 0})
        data[coll] = await cursor.to_list(length=None)
    return data

async def _restore_db_from_data(data: dict):
    collections = ["users", "service_points", "tickets", "settings", "chats", "ping_results"]
    for coll in collections:
        if coll in data and isinstance(data[coll], list):
            # Hati-hati: Menghapus data lama sebelum ditimpa data baru
            await db[coll].delete_many({})
            if data[coll]:
                await db[coll].insert_many(data[coll])

# ============ BACKUP / RESTORE DATABASE (JSON) ============

@api_router.get("/settings/backup")
async def backup_database(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya Admin yang bisa backup data, Boska!")
    
    data = await _get_full_db_dump()
    return data

@api_router.post("/settings/restore")
async def restore_database(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya Admin yang bisa restore data!")
    
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Format file harus JSON!")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        await _restore_db_from_data(data)
        logger.info(f"Database berhasil di-restore oleh {user['username']}")
        return {"message": "Database berhasil dipulihkan"}
    except Exception as e:
        logger.error(f"Error restore database: {e}")
        raise HTTPException(status_code=500, detail="Gagal membaca file atau memulihkan data")

# ============ BACKUP / RESTORE FULL (JSON + FOTO ZIP) ============

@api_router.get("/settings/backup/full")
async def backup_full(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya Admin yang bisa backup full!")
    
    # Buat nama file unik
    now_str = datetime.now().strftime('%Y%m%d_%H%M')
    temp_zip = str(ROOT_DIR / f"temp_backup_{now_str}.zip") # Pastikan jadi string

    try:
        # Tulis langsung ke DISK
        with zipfile.ZipFile(temp_zip, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Database JSON (Tambahkan default=str supaya anti-crash kalau ada format datetime)
            data = await _get_full_db_dump()
            zip_file.writestr("database.json", json.dumps(data, default=str))
            
            # 2. Foto-foto
            if UPLOAD_DIR.exists():
                for file_path in UPLOAD_DIR.iterdir():
                    if file_path.is_file() and file_path.name != ".gitkeep":
                        zip_file.write(file_path, arcname=f"uploads/{file_path.name}")

        # Gunakan FileResponse bawaan FastAPI yang jauh lebih tangguh untuk file fisik
        return FileResponse(
            path=temp_zip,
            filename=f"Backup_Full_ZWMON_{now_str}.zip",
            media_type="application/zip",
            background=BackgroundTask(os.remove, temp_zip), # Otomatis hapus saat download BERES 100%
            headers={"Access-Control-Expose-Headers": "Content-Disposition"}
        )
        
    except Exception as e:
        if os.path.exists(temp_zip): 
            os.remove(temp_zip)
        logger.error(f"Backup Gagal: {e}")
        # Munculkan pesan error aslinya supaya gampang kita tahu kalau masih ada yang salah
        raise HTTPException(status_code=500, detail=f"Gagal ekspor database: {str(e)}")

@api_router.post("/settings/restore/full")
async def restore_full(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya Admin yang bisa restore full!")
    
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Format file harus ZIP!")

    try:
        content = await file.read()
        zip_buffer = io.BytesIO(content)
        
        with zipfile.ZipFile(zip_buffer, 'r') as zip_ref:
            # 1. Restore Database dulu dari database.json di dalam ZIP
            if "database.json" in zip_ref.namelist():
                db_content = zip_ref.read("database.json")
                data = json.loads(db_content.decode('utf-8'))
                await _restore_db_from_data(data)
            else:
                raise HTTPException(status_code=400, detail="File database.json tidak ditemukan di dalam ZIP!")
            
            # 2. Extract dan Restore Foto ke folder uploads/
            UPLOAD_DIR.mkdir(exist_ok=True)
            for file_info in zip_ref.infolist():
                if file_info.filename.startswith("uploads/") and not file_info.is_dir():
                    extracted_name = file_info.filename.split("/")[-1]
                    target_path = UPLOAD_DIR / extracted_name
                    
                    with zip_ref.open(file_info) as source, open(target_path, "wb") as target:
                        shutil.copyfileobj(source, target)
                        
        logger.info(f"Full System Restore (Database + Foto) sukses dilakukan oleh {user['username']}")
        return {"message": "Sistem dan foto berhasil dipulihkan seutuhnya"}
        
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="File yang diupload rusak atau bukan ZIP yang valid")
    except Exception as e:
        logger.error(f"Error restore full: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan sistem saat restore")

# ============ RESTITUTION CALCULATOR ============

@api_router.post("/restitution/calculate")
async def calc_restitution(calc: RestitutionCalc, user: dict = Depends(get_current_user)):
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Hanya AM yang dapat menghitung restitusi")
    
    service = SERVICE_CONFIG.get(calc.service_type)
    if not service:
        raise HTTPException(status_code=400, detail="Tipe layanan tidak valid")
    
    contract_setting = await db.settings.find_one({"key": f"contract_{calc.service_type}"}, {"_id": 0})
    monthly_contract = float(contract_setting['value']) if contract_setting else service['default_contract']
    
    # Updated call with service_type
    result = calculate_restitution(
        service_type=calc.service_type,
        downtime_minutes=calc.downtime_minutes,
        bandwidth_affected=calc.bandwidth_affected,
        monthly_contract=monthly_contract,
        month=calc.month,
        year=calc.year
    )
    
    result['service_name'] = service['name']
    result['service_type'] = calc.service_type
    result['bandwidth_affected'] = calc.bandwidth_affected
    result['total_bandwidth'] = service['total_bandwidth']
    result['monthly_contract'] = monthly_contract
    result['month'] = calc.month
    result['year'] = calc.year
    
    return result

# ============ REPORTS/EXPORT ============

@api_router.get("/reports/tickets")
async def get_ticket_report(
    start_date: str = None,
    end_date: str = None,
    service_type: str = None,
    status: str = None,
    scenario: str = None,
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke laporan")
    
# Ambil offset dari settings atau default 8 (WITA Makassar)
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8

    query = {}
    if start_date:
        # Set jam 00:00 lokal, lalu kurangi 8 jam untuk dapat waktu UTC yang sebenarnya
        local_start = datetime.fromisoformat(f"{start_date[:10]}T00:00:00")
        utc_start = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        query['created_at'] = {"$gte": utc_start}

    if end_date:
        # Set jam 23:59:59 lokal, lalu kurangi 8 jam untuk dapat waktu UTC yang sebenarnya
        local_end = datetime.fromisoformat(f"{end_date[:10]}T23:59:59")
        utc_end = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        
        if 'created_at' in query:
            query['created_at']['$lte'] = utc_end
        else:
            query['created_at'] = {"$lte": utc_end}
    if service_type:
        query['service_type'] = service_type
    if status:
        query['status'] = status
    if scenario:
        query['scenario'] = scenario
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    total = len(tickets)
    by_status = {}
    by_service = {}
    by_scenario = {"A": 0, "B": 0, "none": 0}
    
    total_downtime_scenario_a = 0
    scenario_a_count = 0
    
    # Tambahkan variabel baru untuk Skenario B
    total_downtime_scenario_b = 0
    scenario_b_count = 0
    
    for t in tickets:
        status = t.get('status', 'unknown')
        service = t.get('service_type', 'unknown')
        scenario_val = t.get('scenario')
        
        by_status[status] = by_status.get(status, 0) + 1
        by_service[service] = by_service.get(service, 0) + 1
        
        if scenario_val == 'A':
            by_scenario['A'] += 1
            if t.get('total_downtime_minutes'):
                total_downtime_scenario_a += t['total_downtime_minutes']
                scenario_a_count += 1
        elif scenario_val == 'B':
            by_scenario['B'] += 1
            # Tambahkan logika penjumlahan downtime Skenario B di sini
            if t.get('total_downtime_minutes'):
                total_downtime_scenario_b += t['total_downtime_minutes']
                scenario_b_count += 1
        else:
            by_scenario['none'] += 1
    
    avg_downtime_a = total_downtime_scenario_a / scenario_a_count if scenario_a_count > 0 else 0
    avg_downtime_b = total_downtime_scenario_b / scenario_b_count if scenario_b_count > 0 else 0
    
    return {
        "tickets": tickets,
        "statistics": {
            "total": total,
            "by_status": by_status,
            "by_service": by_service,
            "by_scenario": by_scenario,
            "total_downtime_scenario_a_minutes": total_downtime_scenario_a,
            "avg_downtime_scenario_a_minutes": round(avg_downtime_a, 2),
            # Lempar juga hasilnya ke frontend supaya bisa ditampilkan di laporan
            "total_downtime_scenario_b_minutes": total_downtime_scenario_b,
            "avg_downtime_scenario_b_minutes": round(avg_downtime_b, 2)
        }
    }
@api_router.get("/reports/tickets-pdf")
async def generate_tickets_pdf(
    start_date: str = Query(None),
    end_date: str = Query(None),
    service_type: str = Query(None),
    status: str = Query(None),
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses ke laporan")
    
# Ambil offset dari settings atau default 8 (WITA Makassar)
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8

    query = {}
    if start_date:
        # Set jam 00:00 lokal, lalu kurangi 8 jam untuk dapat waktu UTC yang sebenarnya
        local_start = datetime.fromisoformat(f"{start_date[:10]}T00:00:00")
        utc_start = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        query['created_at'] = {"$gte": utc_start}

    if end_date:
        # Set jam 23:59:59 lokal, lalu kurangi 8 jam untuk dapat waktu UTC yang sebenarnya
        local_end = datetime.fromisoformat(f"{end_date[:10]}T23:59:59")
        utc_end = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        
        if 'created_at' in query:
            query['created_at']['$lte'] = utc_end
        else:
            query['created_at'] = {"$lte": utc_end}
    if service_type and service_type != 'all':
        query['service_type'] = service_type
    if status and status != 'all':
        query['status'] = status
        
    tickets = await db.tickets.find(query).sort("created_at", -1).to_list(1000)
    
    # Siapkan Dokumen
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Heading1'], fontSize=14, spaceAfter=6, alignment=1)
    subtitle_style = ParagraphStyle('Subtitle2', parent=styles['Heading2'], fontSize=11, spaceAfter=8)
    normal_style = ParagraphStyle('Normal2', parent=styles['Normal'], fontSize=8, leading=10)
    small_style = ParagraphStyle('Small2', parent=styles['Normal'], fontSize=7, leading=9)
    id_style = ParagraphStyle('IDStyle', parent=styles['Normal'], fontSize=6.5, leading=8)
    
    elements = []
    
    # 1. KOP SURAT
    logo_path = ROOT_DIR / "telkom_logo.png"
    header_right = Image(str(logo_path), width=25*mm, height=17.7*mm) if logo_path.exists() else ""
    
    periode_teks = "Keseluruhan"
    if start_date and end_date:
        periode_teks = f"{start_date[:10]} s/d {end_date[:10]}"
        
    header_left = [
        Paragraph("<b>LAPORAN REKAPITULASI TIKET GANGGUAN</b>", title_style),
        Paragraph(f"Periode: {periode_teks}", ParagraphStyle('sub', parent=styles['Normal'], fontSize=10, alignment=1))
    ]
    header_table = Table([[header_left, header_right]], colWidths=[150*mm, 35*mm])
    header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (1, 0), (1, 0), 'RIGHT')]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 4*mm))
    elements.append(HorizontalLine(530, colors.black))
    elements.append(Spacer(1, 8*mm))
    
    # 2. STATISTIK & GRAFIK PIE SKENARIO
    scenario_a = sum(1 for t in tickets if t.get('scenario') == 'A')
    scenario_b = sum(1 for t in tickets if t.get('scenario') == 'B')
    unclassified = len(tickets) - scenario_a - scenario_b
    
    elements.append(Paragraph("<b>1. Ringkasan Klasifikasi Skenario Gangguan</b>", subtitle_style))
    
    # Gambar Grafik Pie
    if len(tickets) > 0:
        d = Drawing(400, 140)
        pie = Pie()
        pie.x = 100
        pie.y = 10
        pie.width = 120
        pie.height = 120
        pie.data = [scenario_a, scenario_b, unclassified]
        pie.labels = [
            f"Telkom (A): {scenario_a}" if scenario_a > 0 else "",
            f"Pelanggan (B): {scenario_b}" if scenario_b > 0 else "",
            f"Belum Dicek: {unclassified}" if unclassified > 0 else ""
        ]
        pie.slices.strokeWidth = 0.5
        pie.slices[0].fillColor = colors.HexColor("#E3242B") # Merah Telkom
        pie.slices[1].fillColor = colors.HexColor("#F9A825") # Kuning
        pie.slices[2].fillColor = colors.HexColor("#9E9E9E") # Abu-abu
        d.add(pie)
        elements.append(d)
        elements.append(Spacer(1, 5*mm))

    # 3. TABEL DAFTAR TIKET LENGKAP
    elements.append(Paragraph("<b>2. Rincian Penanganan Tiket</b>", subtitle_style))
    
    status_labels = {
        "open": "Terbuka", "assigned": "Tugas", "in_progress": "Kerja",
        "pending_review": "Review", "pending_verification": "Verifikasi", 
        "escalated": "Eskalasi", "closed": "Selesai"
    }
    svc_names = {"cctv": "CCTV", "skpd": "SKPD", "ip_speaker": "Speaker"}
    
    header = ["ID Tiket", "Layanan", "Skenario", "Mulai", "Selesai", "Down (Min)", "Status"]
    rows = [header]
    
    def safe_float(val, default=0):
        try:
            if not val: return float(default)
            return float(str(val).lower().replace('mbps','').replace('menit','').replace(',','.').strip())
        except:
            return float(default)

    # Tambahkan ini sebelum masuk ke loop (untuk ambil offset zona waktu 1 kali saja biar kencang)
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8
    
    def format_to_local(utc_str):
        if not utc_str: return "-"
        try:
            dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
            local_dt = dt + timedelta(hours=offset_hours)
            return local_dt.strftime('%d/%m/%Y %H:%M')
        except:
            return utc_str
        
    for t in tickets:
        safe_id = str(t.get('id') or '-')
        svc = svc_names.get(t.get('service_type', ''), str(t.get('service_type', '-')))
        sken = str(t.get('scenario') or '-')
        
        dt_start = format_to_local(t.get('created_at'))
        dt_end = format_to_local(t.get('closed_at'))
        
        downtime = safe_float(t.get('total_downtime_minutes'))
        stat = status_labels.get(t.get('status', ''), str(t.get('status', '-')))
        
        rows.append([
            Paragraph(safe_id, id_style),
            Paragraph(svc, small_style),
            sken,
            Paragraph(dt_start, small_style),
            Paragraph(dt_end, small_style),
            f"{downtime:g}",
            Paragraph(stat, small_style)
        ])
        
    if len(tickets) == 0:
        rows.append(["-", "Tidak ada data tiket", "-", "-", "-", "-", "-"])

    ticket_table = Table(rows, colWidths=[30*mm, 20*mm, 15*mm, 35*mm, 35*mm, 18*mm, 30*mm])
    ticket_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'), # Skenario rata tengah
        ('ALIGN', (5, 0), (5, -1), 'CENTER'), # Downtime rata tengah
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.98)]),
    ]))
    
    elements.append(ticket_table)
    elements.append(Spacer(1, 15*mm))
    
    # 4. TANDA TANGAN (Opsional, biar makin resmi)
    now = datetime.now(timezone.utc)
    sign_data = [
        [f"Dicetak pada: {now.strftime('%d-%m-%Y %H:%M')}"],
        ["ZWMON System"]
    ]
    sign_table = Table(sign_data, colWidths=[180*mm])
    sign_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT'), ('FONTSIZE', (0, 0), (-1, -1), 8), ('TEXTCOLOR', (0, 0), (-1, -1), colors.grey)]))
    elements.append(sign_table)

    # Render PDF
    doc.build(elements)
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    filename = f"Laporan_Tiket_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"', 
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
@api_router.get("/reports/evaluation-pdf")
async def generate_evaluation_pdf(
    period_type: str = Query('bulanan'),
    year: int = Query(None),
    month: int = Query(None),
    quarter: int = Query(None),
    semester: int = Query(None),
    service_type: str = 'all',
    sign_date: str = Query(None),
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Tidak memiliki hak akses")

    try:
        now = datetime.now(timezone.utc)
        target_year = int(year) if year else now.year
        import calendar

        start_date = None
        end_date = None
        period_label = ""
        month_names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

        # --- LOGIKA TANGGAL BARU BOSKA (FIX ZONA WAKTU PDF EVALUASI) ---
        tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
        offset_hours = int(tz_setting['value']) if tz_setting else 8

        if period_type == 'bulanan':
            target_month = int(month) if month else now.month
            last_day = calendar.monthrange(target_year, target_month)[1]
            
            local_start = datetime(target_year, target_month, 1, 0, 0, 0)
            local_end = datetime(target_year, target_month, last_day, 23, 59, 59, 999999)
            start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            
            period_label = f"Bulan {month_names[target_month]} {target_year}"
            
        elif period_type == 'triwulan':
            q = int(quarter) if quarter else 1
            start_month = (q - 1) * 3 + 1
            end_month = start_month + 2
            last_day = calendar.monthrange(target_year, end_month)[1]
            
            local_start = datetime(target_year, start_month, 1, 0, 0, 0)
            local_end = datetime(target_year, end_month, last_day, 23, 59, 59, 999999)
            start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            
            period_label = f"Triwulan {'I' if q==1 else 'II' if q==2 else 'III' if q==3 else 'IV'} Tahun {target_year}"
            
        elif period_type == 'semester':
            s = int(semester) if semester else 1
            start_month = 1 if s == 1 else 7
            end_month = 6 if s == 1 else 12
            last_day = calendar.monthrange(target_year, end_month)[1]
            
            local_start = datetime(target_year, start_month, 1, 0, 0, 0)
            local_end = datetime(target_year, end_month, last_day, 23, 59, 59, 999999)
            start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            
            period_label = f"Semester {'I' if s==1 else 'II'} Tahun {target_year}"
            
        elif period_type == 'tahunan':
            local_start = datetime(target_year, 1, 1, 0, 0, 0)
            local_end = datetime(target_year, 12, 31, 23, 59, 59, 999999)
            start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
            
            period_label = f"Tahun {target_year}"
            
        else:
            raise ValueError("Period type tidak valid")
            
    except Exception as e:
        logger.error(f"Error parameter tanggal: {e}")
        raise HTTPException(status_code=400, detail=f"Parameter waktu tidak valid: {str(e)}")

    try:
        query = {"created_at": {"$gte": start_date, "$lte": end_date}}
        svc_label = "Semua Layanan"
        if service_type and service_type != 'all':
            query['service_type'] = service_type
            try:
                svc_label = SERVICE_CONFIG.get(service_type, {}).get('name', service_type.upper())
            except:
                svc_label = service_type.upper()

        tickets = await db.tickets.find(query).sort("created_at", 1).to_list(5000)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=20*mm, bottomMargin=20*mm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title2', parent=styles['Heading1'], fontSize=14, spaceAfter=6, alignment=1)
        subtitle_style = ParagraphStyle('Subtitle2', parent=styles['Heading2'], fontSize=11, spaceAfter=8)
        normal_style = ParagraphStyle('Normal2', parent=styles['Normal'], fontSize=9, leading=12)
        small_style = ParagraphStyle('Small2', parent=styles['Normal'], fontSize=7, leading=9)
        id_style = ParagraphStyle('IDStyle', parent=styles['Normal'], fontSize=6.5, leading=8)
        
        elements = []

        logo_path = ROOT_DIR / "telkom_logo.png"
        header_right = Image(str(logo_path), width=25*mm, height=17.7*mm) if logo_path.exists() else ""
        header_left = [
            Paragraph("<b>LAPORAN EVALUASI PERIODIK SLA & GANGGUAN</b>", title_style),
            Paragraph(f"Periode: {period_label} | Layanan: {svc_label}", ParagraphStyle('sub', parent=styles['Normal'], fontSize=10, alignment=1))
        ]
        header_table = Table([[header_left, header_right]], colWidths=[150*mm, 35*mm])
        header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (1, 0), (1, 0), 'RIGHT')]))
        
        elements.append(header_table)
        elements.append(Spacer(1, 4*mm))
        elements.append(HorizontalLine(530, colors.black))
        elements.append(Spacer(1, 8*mm))

        def safe_float(val, default=0):
            try:
                if not val: return float(default)
                clean_str = str(val).lower().replace('mbps','').replace('menit','').replace(',','.').strip()
                return float(clean_str)
            except:
                return float(default)

        total_tickets = len(tickets)
        closed_a = [t for t in tickets if t.get('status') == 'closed' and t.get('scenario') == 'A']
        closed_b = [t for t in tickets if t.get('status') == 'closed' and t.get('scenario') == 'B']
        
        total_downtime = sum(safe_float(t.get('total_downtime_minutes')) for t in closed_a)
        total_downtime_b = sum(safe_float(t.get('total_downtime_minutes')) for t in closed_b)
        
        avg_uptime = 100
        if total_tickets > 0 or True:
            dt_start = datetime.fromisoformat(start_date)
            dt_end = datetime.fromisoformat(end_date)
            total_mins_period = int((dt_end - dt_start).total_seconds() / 60)

            if service_type and service_type != 'all':
                points_count = await db.service_points.count_documents({"service_type": service_type, "is_active": True})
            else:
                points_count = await db.service_points.count_documents({"is_active": True})
            
            points_count = max(1, points_count)
            total_capacity_mins = total_mins_period * points_count
            avg_uptime = ((total_capacity_mins - total_downtime) / total_capacity_mins * 100) if total_capacity_mins > 0 else 100

        # --- HITUNG DULU RESTITUSINYA SUPAYA BISA DIKIRIM KE AI ---
        total_restitusi = 0
        rest_rows = [["ID Tiket", "Layanan", "Down\n(Min)", "Penyebab / Root Cause", "Tindak Lanjut / Solusi", "Nilai Restitusi"]]
        
        for t in closed_a:
            svc = str(t.get('service_type') or '-') 
            bw = safe_float(t.get('bandwidth'), 10)
            dt = safe_float(t.get('total_downtime_minutes'), 0)
            
            contract_setting = await db.settings.find_one({"key": f"contract_{svc}"}, {"_id": 0})
            contract_val = safe_float(contract_setting.get('value') if contract_setting else 0)
            
            penyebab = str(t.get('diagnosis') or t.get('root_cause') or 'Gangguan Link/Perangkat')
            solusi = str(t.get('resolution') or t.get('action_taken') or 'Perbaikan Layanan')

            try:
                t_date = datetime.fromisoformat(str(t.get('created_at', now.isoformat())).replace('Z', '+00:00'))
                local_t_date = t_date + timedelta(hours=offset_hours)
                t_month = target_month if period_type == 'bulanan' else local_t_date.month
                t_year = target_year if period_type == 'bulanan' else local_t_date.year
            except Exception:
                t_month = target_month if period_type == 'bulanan' else now.month
                t_year = target_year

            result = calculate_restitution(svc, dt, bw, contract_val, t_month, t_year)
            rest_amount = result.get('restitution_amount', 0) if isinstance(result, dict) else 0
            total_restitusi += rest_amount
            
            if rest_amount > 0 or dt > 0: 
                safe_id = str(t.get('id') or '-')
                rest_rows.append([
                    Paragraph(safe_id, id_style), svc.upper(), f"{dt:g}",
                    Paragraph(penyebab, small_style), Paragraph(solusi, small_style),
                    f"Rp {rest_amount:,.0f}" if rest_amount > 0 else "Rp 0"
                ])

        if len(rest_rows) == 1:
            rest_rows.append(["-", "Aman", "0", "-", "-", "Rp 0"])
        rest_rows.append(["", "", "", "", "TOTAL RESTITUSI", f"Rp {total_restitusi:,.0f}"])

        # --- PANGGIL KONSULTAN AI KITA DI SINI ---
        ai_data_payload = {
            "period": period_label,
            "total_tickets": total_tickets,
            "scenario_a": len(closed_a),
            "downtime_a": total_downtime,
            "scenario_b": len(closed_b),
            "downtime_b": total_downtime_b,
            "uptime": round(avg_uptime, 3),
            "restitution": f"{total_restitusi:,.0f}"
        }
        
        # Await proses AI (ini butuh waktu beberapa detik)
        ai_narrative = await generate_ai_narrative(ai_data_payload)


        # --- 1. RENDER PDF: RINGKASAN EKSEKUTIF ---
        elements.append(Paragraph("<b>1. Ringkasan Eksekutif & Komparasi Gangguan</b>", subtitle_style))
        
        # Masukkan hasil tulisan AI (dipecah per paragraf)
        for p_text in ai_narrative['ringkasan'].split('\n\n'):
            if p_text.strip():
                elements.append(Paragraph(p_text.strip(), ParagraphStyle('JustifyStyle', parent=styles['Normal'], fontSize=9, leading=14, alignment=4)))
                elements.append(Spacer(1, 3*mm))
        
        elements.append(Spacer(1, 5*mm))

        # Render Grafik Pie
        if len(closed_a) > 0 or len(closed_b) > 0:
            d = Drawing(400, 160)
            pie = Pie()
            pie.x = 130
            pie.y = 20
            pie.width = 120
            pie.height = 120
            pie.data = [len(closed_a), len(closed_b)]
            label_a = f"Penyedia (A): {len(closed_a)}" if len(closed_a) > 0 else ""
            label_b = f"Pelanggan (B): {len(closed_b)}" if len(closed_b) > 0 else ""
            pie.labels = [label_a, label_b]
            pie.slices.strokeWidth = 0.5
            pie.slices[0].fillColor = colors.HexColor("#E3242B")
            pie.slices[1].fillColor = colors.HexColor("#F9A825")
            d.add(pie)
            elements.append(d)
            elements.append(Spacer(1, 5*mm))

        summary_data = [
            ["Total Tiket Gangguan", f"{total_tickets} Tiket"],
            ["Gangguan Sisi Penyedia / Telkom (A)", f"{len(closed_a)} Tiket (Down: {total_downtime:g} Min)"],
            ["Gangguan Sisi Pelanggan (B)", f"{len(closed_b)} Tiket (Down: {total_downtime_b:g} Min)"],
            ["Rata-rata Uptime (Skenario A)", f"{avg_uptime:.3f}% (Target: 99.5%)"],
        ]
        sum_table = Table(summary_data, colWidths=[90*mm, 90*mm])
        sum_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (0, -1), colors.Color(0.95, 0.95, 0.95)),
            ('PADDING', (0, 0), (-1, -1), 6)
        ]))
        elements.append(sum_table)
        elements.append(Spacer(1, 8*mm))

        # --- 2. RENDER PDF: TABEL RESTITUSI ---
        elements.append(Paragraph("<b>2. Kalkulasi Restitusi (Gangguan Skenario A)</b>", subtitle_style))
        rest_table = Table(rest_rows, colWidths=[32*mm, 18*mm, 12*mm, 45*mm, 50*mm, 28*mm])
        rest_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (4, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (4, -1), (-1, -1), colors.Color(0.9, 0.9, 0.9)),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'), 
        ]))
        elements.append(rest_table)
        
        formula_text = "<b>*Formula Perhitungan Restitusi:</b> <i>(Total Menit Downtime Skenario A / Total Menit Kapasitas Layanan Dalam Sebulan) x Nilai Kontrak</i>."
        elements.append(Spacer(1, 2*mm))
        elements.append(Paragraph(formula_text, ParagraphStyle('small_italic', parent=styles['Normal'], fontSize=7.5, textColor=colors.Color(0.3, 0.3, 0.3))))
        elements.append(Spacer(1, 8*mm))

        # --- 3. RENDER PDF: ANALISIS & KESIMPULAN DARI AI ---
        elements.append(Paragraph("<b>3. Analisis Ekstensif & Kesimpulan Performansi</b>", subtitle_style))
        
        # Masukkan hasil tulisan AI untuk kesimpulan (dipecah per paragraf)
        for p_text in ai_narrative['kesimpulan'].split('\n\n'):
            if p_text.strip():
                elements.append(Paragraph(p_text.strip(), ParagraphStyle('JustifyStyle', parent=styles['Normal'], fontSize=9, leading=14, alignment=4)))
                elements.append(Spacer(1, 3*mm))
                
        elements.append(Spacer(1, 8*mm))

        elements.append(Paragraph("<b>5. Dokumentasi Perbaikan Terpilih</b>", subtitle_style))
        img_elements = []
        safe_closed_a = sorted(closed_a, key=lambda x: safe_float(x.get('total_downtime_minutes')), reverse=True)
        
        for t in safe_closed_a:
            photos = t.get('logbook', {}).get('phase4', {}).get('photos', [])
            for url in photos:
                try:
                    if not url: continue
                    filename = str(url).split('/')[-1]
                    local_path = UPLOAD_DIR / filename
                    if local_path.exists() and len(img_elements) < 4:
                        img = Image(str(local_path))
                        ratio = img.imageHeight / img.imageWidth
                        img.drawWidth = 40 * mm
                        img.drawHeight = 40 * mm * ratio
                        img_elements.append(img)
                except:
                    pass
            if len(img_elements) >= 4:
                break

        if img_elements:
            img_table = Table([img_elements], colWidths=[45*mm]*len(img_elements))
            img_table.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
            elements.append(img_table)
        else:
            elements.append(Paragraph("<i>Tidak ada dokumentasi foto perbaikan pada periode ini.</i>", normal_style))
            
        elements.append(Spacer(1, 20*mm))
        
        # --- PROSES TANGGAL TTD YANG DIKIRIM DARI FRONTEND ---
        if sign_date and sign_date != "undefined" and sign_date != "":
            try:
                sd_obj = datetime.strptime(sign_date[:10], "%Y-%m-%d")
                safe_time_str = f"{sd_obj.day} {month_names[sd_obj.month]} {sd_obj.year}"
            except Exception as e:
                logger.error(f"Gagal parse tanggal: {e}")
                safe_time_str = sign_date
        else:
            raw_time = await get_local_time(now.isoformat())
            safe_time_str = str(raw_time)[:10] if raw_time else str(now.date())
        
        sign_data = [
            [f"Makassar, {safe_time_str}"],
            ["Account Manager"],
            [""], [""], [""],
            ["( Wulan Setya Ningsih )"]
        ]
        sign_table = Table(sign_data, colWidths=[185*mm])
        sign_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT'), ('FONTSIZE', (0, 0), (-1, -1), 9)]))
        elements.append(sign_table)

        doc.build(elements)

        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        safe_label = period_label.replace(' ', '_').replace('(', '').replace(')', '')
        filename = f"Evaluasi_SLA_{safe_label}.pdf"
        
        from fastapi.responses import Response

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"', 
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"FATAL ERROR saat membuat PDF Evaluasi:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Gagal menyusun PDF di server. Detail: {str(e)}")
# ============ DASHBOARD STATS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    month: int = Query(None), 
    year: int = Query(None), 
    service_type: str = None, 
    user: dict = Depends(get_current_user)
):
    stats = {}
    
    # FILTER BULAN & TAHUN
    now = datetime.now(timezone.utc)
    target_month = month if month else now.month
    target_year = year if year else now.year

    import calendar
    last_day = calendar.monthrange(target_year, target_month)[1]
    
    # Ambil offset dari settings atau default 8 (WITA)
    try:
        tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
        offset_hours = int(tz_setting['value']) if tz_setting and tz_setting.get('value') else 8
    except Exception:
        offset_hours = 8

    # Set batas awal dan akhir bulan berdasarkan waktu lokal kita
    local_start = datetime(target_year, target_month, 1, 0, 0, 0)
    local_end = datetime(target_year, target_month, last_day, 23, 59, 59, 999999)

    # Kurangi offset untuk mendapatkan nilai UTC sebenarnya, baru di-isoformat
    start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
    end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
    
    query = {"created_at": {"$gte": start_date, "$lte": end_date}}
    if service_type:
        query['service_type'] = service_type
    
    # --- PERBAIKAN: Data Ping Realtime (Titik layanan jangan difilter berdasarkan bulan!) ---
    sp_query = {"is_active": True}
    if service_type:
        sp_query['service_type'] = service_type
        
    all_points = await db.service_points.find(sp_query).to_list(5000)
    
    ping_details = {
        "cctv": {"online": 0, "offline": 0},
        "skpd": {"online": 0, "offline": 0},
        "ip_speaker": {"online": 0, "offline": 0}
    }
    
    for pt in all_points:
        svc = pt.get('service_type')
        if svc in ping_details:
            latest_ping = await db.ping_results.find_one(
                {"service_point_id": pt['id']},
                sort=[("timestamp", -1)]
            )
            status = latest_ping.get('status', 'unknown') if latest_ping else 'unknown'
            if status in ["online", "offline"]:
                ping_details[svc][status] += 1
            
    stats['ping_details'] = ping_details

    # Data Tiket Berdasarkan Bulan
    if user['role'] == 'admin':
        stats['total_users'] = await db.users.count_documents({})
        stats['total_tickets'] = await db.tickets.count_documents(query)
        stats['open_tickets'] = await db.tickets.count_documents({**query, "status": "open"})
        stats['closed_tickets'] = await db.tickets.count_documents({**query, "status": "closed"})
        stats['total_service_points'] = await db.service_points.count_documents({})
    
    elif user['role'] == 'am':
        stats['pending_verification'] = await db.tickets.count_documents({**query, "status": "pending_verification"})
        stats['verified_today'] = await db.tickets.count_documents({
            **query,
            "am_verified": True
        })
        stats['total_closed'] = await db.tickets.count_documents({**query, "status": "closed"})
        stats['scenario_a_count'] = await db.tickets.count_documents({**query, "scenario": "A"})
        stats['scenario_b_count'] = await db.tickets.count_documents({**query, "scenario": "B"})
        
        # PERBAIKAN: Hitung Restitusi MURNI Skenario A di bulan terpilih (Anti-Crash)
        month_closed_a = await db.tickets.find(
            {**query, "status": "closed", "scenario": "A"},
            {"_id": 0, "total_downtime_minutes": 1, "bandwidth": 1, "service_type": 1}
        ).to_list(5000)
        
        monthly_restitution = 0
        for t in month_closed_a:
            svc = t.get('service_type')
            if not svc: continue
            
            svc_config = SERVICE_CONFIG.get(svc, {})
            
            bw = t.get('bandwidth')
            if not bw:
                bw = svc_config.get('bandwidth_per_point', 10)
                
            downtime = t.get('total_downtime_minutes')
            if not downtime:
                downtime = 0
                
            if downtime > 0:
                contract_setting = await db.settings.find_one({"key": f"contract_{svc}"}, {"_id": 0})
                
                try:
                    if contract_setting and contract_setting.get('value'):
                        monthly_contract = float(contract_setting['value'])
                    else:
                        monthly_contract = svc_config.get('default_contract', 0)
                except Exception:
                    monthly_contract = svc_config.get('default_contract', 0)

                result = calculate_restitution(
                    service_type=svc,
                    downtime_minutes=downtime,
                    bandwidth_affected=bw,
                    monthly_contract=monthly_contract,
                    month=target_month,
                    year=target_year
                )
                
                if isinstance(result, dict) and 'restitution_amount' in result:
                    monthly_restitution += result['restitution_amount']
        
        stats['daily_restitution'] = int(round(monthly_restitution))
    
    elif user['role'] == 'helpdesk':
        stats['open_tickets'] = await db.tickets.count_documents({**query, "status": "open"})
        stats['assigned_tickets'] = await db.tickets.count_documents({**query, "status": "assigned"})
        stats['in_progress'] = await db.tickets.count_documents({**query, "status": "in_progress"})
        stats['pending_review'] = await db.tickets.count_documents({**query, "status": "pending_review"})
    
    elif user['role'] == 'eos':
        my_query = {"assigned_to": user['id'], **query}
        stats['assigned_to_me'] = await db.tickets.count_documents({**my_query, "status": {"$in": ["assigned", "in_progress"]}})
        stats['completed_today'] = await db.tickets.count_documents({
            **my_query,
            "completion_time": {"$ne": None}
        })
    
    elif user['role'] == 'client':
        my_query = {"client_id": user['id'], **query}
        stats['my_tickets'] = await db.tickets.count_documents(my_query)
        stats['open_tickets'] = await db.tickets.count_documents({**my_query, "status": {"$in": ["open", "assigned", "in_progress"]}})
        stats['pending_review'] = await db.tickets.count_documents({**my_query, "status": "pending_review"})
    
    # Breakdown per service untuk bulan ini
    for svc in ['cctv', 'skpd', 'ip_speaker']:
        svc_query = {"service_type": svc, **query}
        if user['role'] == 'client':
            svc_query['client_id'] = user['id']
        elif user['role'] == 'eos':
            svc_query['assigned_to'] = user['id']
        
        stats[f'{svc}_total'] = await db.tickets.count_documents(svc_query)
        stats[f'{svc}_open'] = await db.tickets.count_documents({**svc_query, "status": {"$in": ["open", "assigned", "in_progress"]}})
    
    ticket_query = {**query}
    if user['role'] == 'client':
        ticket_query['client_id'] = user['id']
    elif user['role'] == 'eos':
        ticket_query['assigned_to'] = user['id']
    
    recent_tickets = await db.tickets.find(ticket_query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    stats['recent_tickets'] = recent_tickets
    
    return stats

@api_router.get("/dashboard/chart-data")
async def get_dashboard_chart_data(
    month: int = Query(None), 
    year: int = Query(None), 
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    now = datetime.now(timezone.utc)
    target_month = month if month else now.month
    target_year = year if year else now.year

    # --- LOGIKA TANGGAL BARU BOSKA ---
    import calendar
    last_day = calendar.monthrange(target_year, target_month)[1]
    
    # Ambil offset dari settings atau default 8 (WITA)
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8

    # Set batas awal dan akhir bulan berdasarkan waktu lokal kita
    local_start = datetime(target_year, target_month, 1, 0, 0, 0)
    local_end = datetime(target_year, target_month, last_day, 23, 59, 59, 999999)

    # Kurangi offset untuk mendapatkan nilai UTC sebenarnya, baru di-isoformat
    start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
    end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
    query = {"created_at": {"$gte": start_date, "$lt": end_date}}
    
    all_tickets = await db.tickets.find(query, {"_id": 0, "status": 1, "service_type": 1, "scenario": 1, "total_downtime_minutes": 1, "created_at": 1, "priority": 1}).to_list(5000)
    
    by_status = {}
    for t in all_tickets:
        s = t.get('status', 'unknown')
        by_status[s] = by_status.get(s, 0) + 1
    
    status_labels = {
        "open": "Terbuka", "assigned": "Ditugaskan", "in_progress": "Sedang Dikerjakan",
        "pending_verification": "Verifikasi AM", "escalated": "Dieskalasi", "closed": "Selesai"
    }
    status_chart = [{"name": status_labels.get(k, k), "value": v, "key": k} for k, v in by_status.items()]
    
    by_service = {}
    for t in all_tickets:
        svc = t.get('service_type', 'unknown')
        by_service[svc] = by_service.get(svc, 0) + 1
    
    service_labels = {"cctv": "CCTV", "skpd": "Internet SKPD", "ip_speaker": "IP Speaker"}
    service_chart = [{"name": service_labels.get(k, k), "value": v, "key": k} for k, v in by_service.items()]
    
    scenario_a = sum(1 for t in all_tickets if t.get('scenario') == 'A')
    scenario_b = sum(1 for t in all_tickets if t.get('scenario') == 'B')
    unclassified = len(all_tickets) - scenario_a - scenario_b
    scenario_chart = [
        {"name": "Skenario A (Telkom)", "value": scenario_a, "key": "A"},
        {"name": "Skenario B (Pengguna)", "value": scenario_b, "key": "B"},
        {"name": "Belum Diklasifikasi", "value": unclassified, "key": "none"}
    ]
    
    by_priority = {}
    for t in all_tickets:
        p = t.get('priority', 'medium')
        by_priority[p] = by_priority.get(p, 0) + 1
    priority_labels = {"low": "Rendah", "medium": "Sedang", "high": "Tinggi", "critical": "Kritis"}
    priority_chart = [{"name": priority_labels.get(k, k), "value": v, "key": k} for k, v in by_priority.items()]
    
    closed_a = [t for t in all_tickets if t.get('status') == 'closed' and t.get('scenario') == 'A']
    sla_met = sum(1 for t in closed_a if (t.get('total_downtime_minutes') or 0) <= 216)
    sla_breached = len(closed_a) - sla_met
    sla_chart = [
        {"name": "SLA Terpenuhi", "value": sla_met, "key": "met"},
        {"name": "SLA Dilanggar", "value": sla_breached, "key": "breached"}
    ]
    
    return {
        "by_status": status_chart,
        "by_service": service_chart,
        "by_scenario": scenario_chart,
        "by_priority": priority_chart,
        "sla_compliance": sla_chart,
        "total_tickets": len(all_tickets)
    }

# ============ NETWORK MONITORING ============

@api_router.get("/monitoring/status")
async def get_monitoring_status(user: dict = Depends(get_current_user)):
    if user['role'] == 'client':
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    service_points = await db.service_points.find({}, {"_id": 0}).to_list(5000)
    
    results = []
    for sp in service_points:
        latest = await db.ping_results.find_one(
            {"service_point_id": sp['id']},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        
        results.append({
            "id": sp['id'],
            "name": sp.get('name', ''),
            "location": sp.get('location', ''),
            "ip_address": sp.get('ip_address', '-'),
            "service_type": sp.get('service_type', ''),
            "bandwidth": sp.get('bandwidth', 0),
            "status": latest.get('status', 'unknown') if latest else 'unknown',
            "response_time_ms": latest.get('response_time_ms') if latest else None,
            "last_check": latest.get('timestamp') if latest else None,
            "last_online": latest.get('timestamp') if latest and latest.get('status') == 'online' else None
        })
    
    config = await db.settings.find_one({"key": "ping_interval"}, {"_id": 0})
    ping_interval = int(config['value']) if config else 3
    
    online = sum(1 for r in results if r['status'] == 'online')
    offline = sum(1 for r in results if r['status'] == 'offline')
    unknown = sum(1 for r in results if r['status'] == 'unknown')
    
    return {
        "points": results,
        "summary": {"total": len(results), "online": online, "offline": offline, "unknown": unknown},
        "ping_interval_hours": ping_interval
    }

@api_router.get("/monitoring/history/{service_point_id}")
async def get_ping_history(service_point_id: str, hours: int = 24, user: dict = Depends(get_current_user)):
    if user['role'] == 'client':
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    results = await db.ping_results.find(
        {"service_point_id": service_point_id, "timestamp": {"$gte": since}},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(5000)
    
    return {"history": results}

@api_router.post("/monitoring/ping")
async def run_ping_check(user: dict = Depends(get_current_user)):
    if user['role'] == 'client':
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    service_points = await db.service_points.find({}, {"_id": 0}).to_list(5000)
    results = []
    
    for sp in service_points:
        ip = sp.get('ip_address', '')
        if not ip or ip == '-':
            status = 'unknown'
            response_time = None
        else:
            status, response_time = await _ping_host(ip)
        
        ping_doc = {
            "id": str(uuid.uuid4()),
            "service_point_id": sp['id'],
            "ip_address": ip,
            "status": status,
            "response_time_ms": response_time,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.ping_results.insert_one(ping_doc)
        results.append({"name": sp.get('name'), "ip": ip, "status": status, "ms": response_time})
    
    online = sum(1 for r in results if r['status'] == 'online')
    offline = sum(1 for r in results if r['status'] == 'offline')
    await ws_manager.send_to_role("admin", {"type": "ping_update", "online": online, "offline": offline})
    await ws_manager.send_to_role("am", {"type": "ping_update", "online": online, "offline": offline})
    await ws_manager.send_to_role("helpdesk", {"type": "ping_update", "online": online, "offline": offline})
    await ws_manager.send_to_role("eos", {"type": "ping_update", "online": online, "offline": offline})
    
    return {"message": f"Ping selesai: {online} online, {offline} offline", "results": results}

@api_router.put("/monitoring/interval")
async def set_ping_interval(interval: int, user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya admin")
    if interval not in [1, 3, 6, 12, 24]:
        raise HTTPException(status_code=400, detail="Interval harus 1, 3, 6, 12, atau 24 jam")
    
    await db.settings.update_one(
        {"key": "ping_interval"},
        {"$set": {"key": "ping_interval", "value": str(interval)}},
        upsert=True
    )
    return {"message": f"Interval ping diubah ke {interval} jam"}

async def _ping_host(ip: str):
    import asyncio
    try:
        # Gunakan asyncio create_subprocess_exec supaya tidak blocking main thread
        proc = await asyncio.create_subprocess_exec(
            'ping', '-c', '1', '-W', '2', ip,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            if proc.returncode == 0:
                output = stdout.decode()
                if 'time=' in output:
                    time_str = output.split('time=')[1].split(' ')[0]
                    return ('online', round(float(time_str), 1))
                return ('online', None)
            return ('offline', None)
        except asyncio.TimeoutError:
            if proc:
                proc.kill()
            return ('offline', None)
    except Exception as e:
        logger.error(f"Ping error for {ip}: {e}")
        return ('offline', None)

async def _ping_scheduler():
    while True:
        try:
            config = await db.settings.find_one({"key": "ping_interval"}, {"_id": 0})
            interval_hours = int(config['value']) if config else 3
            
            service_points = await db.service_points.find({"is_active": True}, {"_id": 0}).to_list(None)
            
            # --- PERBAIKAN: Jalankan secara Concurrently (Semua jalan bareng) ---
            async def task(sp):
                ip = sp.get('ip_address', '')
                if not ip or ip == '-': return
                
                status, response_time = await _ping_host(ip)
                await db.ping_results.insert_one({
                    "id": str(uuid.uuid4()),
                    "service_point_id": sp['id'],
                    "ip_address": ip,
                    "status": status,
                    "response_time_ms": response_time,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })

            # Batasi jumlah ping serentak (misal 50) supaya tidak dianggap DDOS oleh firewall
            semaphore = asyncio.Semaphore(50)
            async def sem_task(sp):
                async with semaphore:
                    await task(sp)

            if service_points:
                await asyncio.gather(*(sem_task(sp) for sp in service_points))
            
            logger.info(f"Siklus Ping Selesai. Menunggu {interval_hours} jam.")
            await asyncio.sleep(interval_hours * 3600)
            
        except Exception as e:
            logger.error(f"Ping scheduler error: {e}")
            await asyncio.sleep(60)

# ============ LIVE CCTV LIST ============

@api_router.get("/cctv/list")
async def get_cctv_list(user: dict = Depends(get_current_user)):
    cctv_points = await db.service_points.find(
        {"service_type": "cctv", "is_active": True}, 
        {"_id": 0}
    ).to_list(1000)
    
    results = []
    for cp in cctv_points:
        latest_ping = await db.ping_results.find_one(
            {"service_point_id": cp['id']},
            sort=[("timestamp", -1)]
        )
        cp['status'] = latest_ping.get('status', 'unknown') if latest_ping else 'unknown'
        results.append(cp)
        
    return {"cctv_list": results}


async def sync_mediamtx_config():
    """Sync all CCTV RTSP URLs to MediaMTX paths"""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            cctvs = await db.service_points.find({"service_type": "cctv"}).to_list(None)
            for point_data in cctvs:
                point_id = point_data.get('id')
                ip = point_data.get('ip_address', '')
                if not ip: continue
                
                user = point_data.get('cctv_username', 'admin')
                pw = point_data.get('cctv_password', '')
                brand = point_data.get('cctv_brand', 'hikvision').lower()

                if brand == 'hikvision':
                    rtsp_path = "/Streaming/Channels/102"
                elif brand == 'samsung' or brand == 'hanwha':
                    rtsp_path = "/profile2/media.smp"
                elif brand == 'avigilon':
                    rtsp_path = "/defaultSecondary?streamType=u"
                elif brand == 'dahua':
                    rtsp_path = "/cam/realmonitor?channel=1&subtype=1"
                else:
                    rtsp_path = "/Streaming/Channels/102"

                rtsp_url = f"rtsp://{user}:{pw}@{ip}:554{rtsp_path}"
                
                # Tambah/Update path di MediaMTX via REST API (Port 9997)
                mediamtx_api = os.getenv("MEDIAMTX_API_URL", "http://host.docker.internal:9997")
                try:
                    payload = {"source": rtsp_url, "sourceOnDemand": True}
                    await client.post(f"{mediamtx_api}/v3/config/paths/add/{point_id}", json=payload)
                except Exception as e:
                    logger.error(f"Gagal sync MediaMTX path untuk {point_id}: {e}")
    except Exception as e:
        logger.error(f"MediaMTX sync error: {e}")

@api_router.post("/cctv/sync")
async def trigger_cctv_sync(background_tasks: BackgroundTasks, token: str = Depends(get_current_user)):
    background_tasks.add_task(sync_mediamtx_config)
    return {"message": "Sync MediaMTX dipicu di background"}

@api_router.get("/cctv/stream/{point_id}")
async def cctv_stream(point_id: str, token: str = Query(None)):
    sp = await db.service_points.find_one({"id": point_id, "service_type": "cctv"})
    if not sp or not sp.get("ip_address"):
        raise HTTPException(status_code=404, detail="CCTV tidak ditemukan")
    
    # Klien frontend kini akan memanggil langsung endpoint WebRTC MediaMTX (/webrtc/{point_id})
    return {"message": "Gunakan MediaMTX WebRTC API untuk streaming", "point_id": point_id}


# ============ SLA COMPLIANCE TRACKING ============

@api_router.get("/sla/compliance")
async def get_sla_compliance(
    months: int = 6,
    service_type: str = None,
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")

    now = datetime.now(timezone.utc)
    results = []

    for i in range(months):
        target_date = now - timedelta(days=30 * i)
        m = target_date.month
        y = target_date.year

        # --- LOGIKA TANGGAL BARU BOSKA ---
        import calendar
        last_day = calendar.monthrange(y, m)[1]

        # Ambil offset dari settings atau default 8 (WITA)
        tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
        offset_hours = int(tz_setting['value']) if tz_setting else 8

        # Set batas awal dan akhir bulan berdasarkan waktu lokal kita (Pakai y dan m)
        local_start = datetime(y, m, 1, 0, 0, 0)
        local_end = datetime(y, m, last_day, 23, 59, 59, 999999)

        # Kurangi offset untuk mendapatkan nilai UTC sebenarnya, baru di-isoformat
        month_start = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        month_end = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()

        query = {"created_at": {"$gte": month_start, "$lte": month_end}}
        
        # --- PERBAIKAN: Hitung jumlah titik layanan untuk faktor pengali ---
        if service_type:
            query['service_type'] = service_type
            points_count = await db.service_points.count_documents({"service_type": service_type, "is_active": True})
        else:
            points_count = await db.service_points.count_documents({"is_active": True})
            
        if points_count == 0:
            points_count = 1 # Jaga-jaga supaya tidak bagi nol

        tickets = await db.tickets.find(query, {"_id": 0, "status": 1, "scenario": 1, "total_downtime_minutes": 1}).to_list(5000)

        total = len(tickets)
        closed = sum(1 for t in tickets if t.get('status') == 'closed')
        scenario_a = sum(1 for t in tickets if t.get('scenario') == 'A')

        days_in_month = calendar.monthrange(y, m)[1]
        
        # Total menit sebulan dikali jumlah titik layanan aktif
        total_minutes = days_in_month * 24 * 60 * points_count

        total_downtime = sum(t.get('total_downtime_minutes', 0) for t in tickets if t.get('scenario') == 'A' and t.get('status') == 'closed')
        
        # Jaga-jaga kalau ada anomali inputan teknisi yang kelewat batas
        if total_downtime > total_minutes:
            total_downtime = total_minutes

        avg_uptime = ((total_minutes - total_downtime) / total_minutes * 100) if total_minutes > 0 else 100
        sla_target = 99.5
        sla_met = avg_uptime >= sla_target

        month_names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

        results.append({
            "month": m,
            "year": y,
            "label": f"{month_names[m]} {y}",
            "total_tickets": total,
            "closed_tickets": closed,
            "scenario_a_count": scenario_a,
            "total_downtime_minutes": total_downtime,
            "uptime_percentage": round(avg_uptime, 4),
            "sla_target": sla_target,
            "sla_met": sla_met
        })

    results.reverse()

    breached = await db.tickets.find(
        {"status": {"$nin": ["closed"]}, "sla_deadline": {"$lt": now.isoformat()}},
        {"_id": 0, "id": 1, "title": 1, "sla_deadline": 1, "status": 1, "service_type": 1, "priority": 1, "created_at": 1}
    ).to_list(100)

    return {
        "monthly_compliance": results,
        "active_breaches": breached,
        "sla_target": 99.5
    }

# ============ DASHBOARD ANALYTICS & PREDICTIONS ============

@api_router.get("/dashboard/analytics")
async def get_dashboard_analytics(user: dict = Depends(get_current_user)):
    # Kasih hak akses cuma untuk Admin, AM, dan Helpdesk supaya aman
    if user['role'] not in ['admin', 'am', 'helpdesk']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses Boska!")
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    # --- 1. TOP 10 TITIK PALING SERING GANGGUAN ---
    pipeline_top_tickets = [
        {"$match": {"service_point_id": {"$ne": None}}},
        {"$group": {
            "_id": "$service_point_id",
            "ticket_count": {"$sum": 1},
            "service_point_name": {"$first": "$service_point_name"},
            "location": {"$first": "$location"},
            "service_type": {"$first": "$service_type"}
        }},
        {"$sort": {"ticket_count": -1}},
        {"$limit": 10}
    ]
    top_tickets = await db.tickets.aggregate(pipeline_top_tickets).to_list(10)
    
    formatted_top = []
    for t in top_tickets:
        formatted_top.append({
            "service_point_id": t["_id"],
            "name": t.get("service_point_name", "-"),
            "location": t.get("location", "-"),
            "service_type": t.get("service_type", "-").upper(),
            "ticket_count": t.get("ticket_count", 0)
        })

    # --- 2. PREDIKSI POTENSI GANGGUAN ---
    pipeline_recent = [
        {"$match": {
            "service_point_id": {"$ne": None}, 
            "created_at": {"$gte": thirty_days_ago}
        }},
        {"$group": {
            "_id": "$service_point_id",
            "recent_ticket_count": {"$sum": 1},
            "service_point_name": {"$first": "$service_point_name"},
            "location": {"$first": "$location"},
            "service_type": {"$first": "$service_type"}
        }},
        {"$match": {"recent_ticket_count": {"$gte": 2}}}, 
        {"$sort": {"recent_ticket_count": -1}}
    ]
    recent_tickets = await db.tickets.aggregate(pipeline_recent).to_list(50)

    predictions = []
    for r in recent_tickets:
        predictions.append({
            "service_point_id": r["_id"],
            "name": r.get("service_point_name", "-"),
            "location": r.get("location", "-"),
            "service_type": r.get("service_type", "-").upper(),
            "recent_issue_count": r.get("recent_ticket_count", 0),
            "status_prediksi": "🔴 Waspada (Sering Rusak)",
            "saran": "Perlu dilakukan pemeliharaan preventif atau pengecekan fisik perangkat/kabel di lokasi supaya tidak mati total."
        })

    # --- 3. TOP 4 EOS (TEKNISI) TERBAIK ---
    # Kita ambil tiket yang sudah selesai (closed) untuk dihitung kinerjanya
    closed_tickets = await db.tickets.find({"status": "closed", "assigned_to": {"$ne": None}}).to_list(5000)
    
    eos_stats = {}
    for t in closed_tickets:
        eos_id = t["assigned_to"]
        eos_name = t.get("assigned_name", "Unknown EOS")
        
        if eos_id not in eos_stats:
            eos_stats[eos_id] = {
                "id": eos_id, 
                "name": eos_name, 
                "ticket_count": 0, 
                "total_response_time": 0, 
                "total_recovery_time": 0
            }
            
        eos_stats[eos_id]["ticket_count"] += 1
        
        # Hitung response time (dari tiket dibuat sampai teknisi tiba)
        resp_time = t.get("logbook", {}).get("phase5", {}).get("response_time_minutes")
        if not resp_time and t.get("arrival_time") and t.get("created_at"):
            try:
                arr = datetime.fromisoformat(t["arrival_time"].replace('Z', '+00:00'))
                cre = datetime.fromisoformat(t["created_at"].replace('Z', '+00:00'))
                resp_time = int(max(0, (arr - cre).total_seconds() / 60))
            except:
                resp_time = 0
                
        # Hitung recovery time (dari teknisi tiba sampai perbaikan selesai)
        recov_time = t.get("total_downtime_minutes")
        if not recov_time and t.get("completion_time") and t.get("arrival_time"):
            try:
                com = datetime.fromisoformat(t["completion_time"].replace('Z', '+00:00'))
                arr = datetime.fromisoformat(t["arrival_time"].replace('Z', '+00:00'))
                recov_time = int(max(0, (com - arr).total_seconds() / 60))
            except:
                recov_time = 0
                
        eos_stats[eos_id]["total_response_time"] += (resp_time or 0)
        eos_stats[eos_id]["total_recovery_time"] += (recov_time or 0)
        
    eos_ranking = []
    for eos in eos_stats.values():
        tc = eos["ticket_count"]
        # Hitung rata-rata response dan recovery dalam menit
        avg_resp = eos["total_response_time"] / tc if tc > 0 else 0
        avg_recov = eos["total_recovery_time"] / tc if tc > 0 else 0
        
        eos_ranking.append({
            "eos_id": eos["id"],
            "name": eos["name"],
            "ticket_count": tc,
            "avg_response_minutes": round(avg_resp, 2),
            "avg_recovery_minutes": round(avg_recov, 2)
        })
        
    # Urutkan berdasarkan: 1. Tiket terbanyak, 2. Respon tercepat, 3. Penyelesaian tercepat
    eos_ranking.sort(key=lambda x: (-x["ticket_count"], x["avg_response_minutes"], x["avg_recovery_minutes"]))
    
    # Ambil Top 4 saja
    top_4_eos = eos_ranking[:4]

    return {
        "top_error_points": formatted_top,
        "predictions": predictions,
        "top_eos": top_4_eos
    }

# ============ RESTITUTION REPORT ============

@api_router.get("/reports/restitution")
async def get_restitution_report(
    month: int = None,
    year: int = None,
    service_type: str = None,
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    
    query = {"status": "closed", "scenario": "A"}
    if service_type:
        query['service_type'] = service_type
    
    # --- LOGIKA TANGGAL BARU BOSKA (FIX ZONA WAKTU) ---
    import calendar
    last_day = calendar.monthrange(year, month)[1]

    # Ambil offset dari settings atau default 8 (WITA)
    tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
    offset_hours = int(tz_setting['value']) if tz_setting else 8

    # Set batas awal dan akhir bulan berdasarkan waktu lokal kita
    local_start = datetime(year, month, 1, 0, 0, 0)
    local_end = datetime(year, month, last_day, 23, 59, 59, 999999)

    # Kurangi offset untuk mendapatkan nilai UTC sebenarnya, baru di-isoformat
    month_start = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
    month_end = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
    
    query['created_at'] = {"$gte": month_start, "$lte": month_end}
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    
    report_items = []
    total_restitution_raw = 0.0
    total_downtime = 0
    
    for t in tickets:
        # Amankan dari KeyError dengan .get()
        svc = t.get('service_type', '')
        svc_config = SERVICE_CONFIG.get(svc, {})
        
        # Amankan nilai null/none jadi default (tidak boleh ada None!)
        bw = t.get('bandwidth')
        if not bw:
            bw = svc_config.get('bandwidth_per_point', 10)
            
        downtime = t.get('total_downtime_minutes')
        if not downtime:
            downtime = 0
        
        contract_setting = await db.settings.find_one({"key": f"contract_{svc}"}, {"_id": 0})
        
        # Amankan konversi float kalau tiba-tiba data setting string kosong ""
        try:
            monthly_contract = float(contract_setting['value']) if contract_setting and contract_setting.get('value') else svc_config.get('default_contract', 0)
        except ValueError:
            monthly_contract = svc_config.get('default_contract', 0)
        
        # Eksekusi dengan aman
        result = calculate_restitution(
            service_type=svc,
            downtime_minutes=downtime,
            bandwidth_affected=bw,
            monthly_contract=monthly_contract,
            month=month,
            year=year
        )
        
        sp = None
        if t.get('service_point_id'):
            sp = await db.service_points.find_one({"id": t['service_point_id']}, {"_id": 0})
        
        # Amankan pembacaan field tiket dengan .get() semua
        item = {
            "ticket_id": t.get('id', '-'),
            "title": t.get('title', ''),
            "service_type": svc,
            "service_point_name": t.get('service_point_name', sp.get('name', '-') if sp else '-'),
            "location": t.get('location', ''),
            "ip_address": sp.get('ip_address', '-') if sp else '-',
            "bandwidth": bw,
            "downtime_minutes": downtime,
            "downtime_days": round(downtime / (24 * 60), 2),
            "closed_at": t.get('closed_at', ''),
            "created_at": t.get('created_at', ''),
            "sla_met": result['sla_met'],
            "uptime_percentage": result['uptime_percentage'],
            "restitution_amount": result['restitution_amount']
        }
        report_items.append(item)
        if result['total_minutes_in_month'] > 0:
            raw_amount = (result['excess_downtime_minutes'] / result['total_minutes_in_month']) * result['pro_rata_fee']
            total_restitution_raw += raw_amount
        total_downtime += downtime
    
    return {
        "month": month,
        "year": year,
        "service_type": service_type,
        "items": report_items,
        "summary": {
            "total_tickets": len(report_items),
            "total_downtime_minutes": total_downtime,
            "total_restitution": int(round(total_restitution_raw)),
            "sla_breached_count": sum(1 for i in report_items if not i['sla_met']),
            "sla_met_count": sum(1 for i in report_items if i['sla_met'])
        }
    }

@api_router.get("/reports/restitution/daily")
async def get_daily_restitution(
    days: int = 30,
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).isoformat()
    
    tickets = await db.tickets.find(
        {"status": "closed", "scenario": "A", "created_at": {"$gte": start}},
        {"_id": 0, "created_at": 1, "total_downtime_minutes": 1, "bandwidth": 1, "service_type": 1}
    ).to_list(5000)
    
    daily = {}
    for t in tickets:
        created_at = t.get('created_at', '')
        if not created_at:
            continue
        day = created_at[:10] 
        if day not in daily:
            daily[day] = {"date": day, "ticket_count": 0, "total_downtime": 0, "estimated_restitution": 0}
        
        daily[day]['ticket_count'] += 1
        downtime = t.get('total_downtime_minutes', 0)
        daily[day]['total_downtime'] += downtime
        
        svc_config = SERVICE_CONFIG.get(t.get('service_type', ''), {})
        bw = t.get('bandwidth', 10)
        
        # PERBAIKAN: Ambil nilai kontrak dari database (tidak default hardcode lagi)
        contract_setting = await db.settings.find_one({"key": f"contract_{t.get('service_type')}"}, {"_id": 0})
        contract = float(contract_setting['value']) if contract_setting else svc_config.get('default_contract', 0)
        
        # Updated call
        result = calculate_restitution(t.get('service_type', ''), downtime, bw, contract, now.month, now.year)
        daily[day]['estimated_restitution'] += result['restitution_amount']
    
    sorted_daily = sorted(daily.values(), key=lambda x: x['date'], reverse=True)
    for d in sorted_daily:
        d['estimated_restitution'] = int(round(d['estimated_restitution']))
    
    return {"daily_restitution": sorted_daily}

# ============ MONTHLY REPORT PDF ============

@api_router.get("/reports/monthly-pdf")
async def generate_monthly_pdf(
    month: int = Query(None),
    year: int = Query(None),
    service_type: str = Query(None),
    user: dict = Depends(get_current_user)
):
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    
    try:
        now = datetime.now(timezone.utc)
        target_month = int(month) if month else now.month
        target_year = int(year) if year else now.year
        
        import calendar
        last_day = calendar.monthrange(target_year, target_month)[1]
        
        # --- LOGIKA TANGGAL BARU BOSKA (FIX ZONA WAKTU PDF) ---
        tz_setting = await db.settings.find_one({"key": "timezone_offset"}, {"_id": 0})
        offset_hours = int(tz_setting['value']) if tz_setting else 8

        # Set batas awal dan akhir bulan berdasarkan waktu lokal kita (WITA)
        local_start = datetime(target_year, target_month, 1, 0, 0, 0)
        local_end = datetime(target_year, target_month, last_day, 23, 59, 59, 999999)

        # Kurangi offset untuk mendapatkan nilai UTC sebenarnya sebelum ke database
        start_date = (local_start - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        end_date = (local_end - timedelta(hours=offset_hours)).replace(tzinfo=timezone.utc).isoformat()
        
        month_names = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        period_label = f"{month_names[target_month]}_{target_year}"
        
        query = {"created_at": {"$gte": start_date, "$lte": end_date}}
        if service_type and service_type != 'all':
            query['service_type'] = service_type
        
        tickets = await db.tickets.find(query).sort("created_at", 1).to_list(5000)
        
        # --- AMANKAN FUNGSI EKSTRAK ANGKA SUPAYA TIDAK CRASH ---
        def safe_float(val, default=0):
            try:
                if not val: return float(default)
                clean_str = str(val).lower().replace('mbps','').replace('menit','').replace(',','.').strip()
                return float(clean_str)
            except:
                return float(default)

        # --- MULAI PDF ---
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=20*mm, bottomMargin=20*mm)
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('Title2', parent=styles['Heading1'], fontSize=14, spaceAfter=6, alignment=1)
        subtitle_style = ParagraphStyle('Subtitle2', parent=styles['Heading2'], fontSize=11, spaceAfter=8)
        normal_style = ParagraphStyle('Normal2', parent=styles['Normal'], fontSize=8, leading=10)
        small_style = ParagraphStyle('Small2', parent=styles['Normal'], fontSize=7, leading=9)
        id_style = ParagraphStyle('IDStyle', parent=styles['Normal'], fontSize=6.5, leading=8)
        
        elements = []
        
        svc_label = "Semua Layanan"
        if service_type and service_type != 'all':
            svc_label = SERVICE_CONFIG.get(service_type, {}).get('name', service_type.upper())

        logo_path = ROOT_DIR / "telkom_logo.png"
        header_right = Image(str(logo_path), width=25*mm, height=17.7*mm) if logo_path.exists() else ""
        header_left = [
            Paragraph("<b>LAPORAN BULANAN PERFORMANSI LAYANAN</b>", title_style),
            Paragraph(f"Periode: {month_names[target_month]} {target_year} | Layanan: {svc_label}", ParagraphStyle('sub', parent=styles['Normal'], fontSize=10, alignment=1))
        ]
        header_table = Table([[header_left, header_right]], colWidths=[150*mm, 35*mm])
        header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (1, 0), (1, 0), 'RIGHT')]))
        
        elements.append(header_table)
        elements.append(Spacer(1, 4*mm))
        elements.append(HorizontalLine(530, colors.black))
        elements.append(Spacer(1, 8*mm))
        
        # --- RINGKASAN STATUS ---
        status_counts = {}
        for t in tickets:
            s = str(t.get('status', 'unknown'))
            status_counts[s] = status_counts.get(s, 0) + 1
        
        elements.append(Paragraph("<b>1. Ringkasan Status Tiket</b>", subtitle_style))
        summary_data = [
            ["Total Tiket", f"{len(tickets)} Tiket"],
            ["Terbuka (Open)", f"{status_counts.get('open', 0)}"],
            ["Sedang Dikerjakan", f"{status_counts.get('in_progress', 0) + status_counts.get('assigned', 0)}"],
            ["Selesai (Closed)", f"{status_counts.get('closed', 0)}"],
        ]
        summary_table = Table(summary_data, colWidths=[60*mm, 40*mm])
        summary_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (0, -1), colors.Color(0.9, 0.9, 0.95)),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 6*mm))
        
        # --- DAFTAR TIKET ---
        elements.append(Paragraph("<b>2. Daftar Seluruh Tiket Bulan Ini</b>", subtitle_style))
        header = ["No", "ID Tiket", "Judul", "Layanan", "Status", "Down (Min)"]
        rows = [header]
        
        svc_names = {"cctv": "CCTV", "skpd": "SKPD", "ip_speaker": "Speaker"}
        status_names = {"open": "Terbuka", "assigned": "Tugas", "in_progress": "Kerja",
                        "pending_verification": "Verifikasi", "closed": "Selesai", "escalated": "Eskalasi"}
        
        for idx, t in enumerate(tickets, 1):
            safe_id = str(t.get('id') or '-')
            safe_title = str(t.get('title') or '-')[:40]
            dt = safe_float(t.get('total_downtime_minutes'))
            
            rows.append([
                str(idx),
                Paragraph(safe_id, id_style),
                Paragraph(safe_title, small_style),
                svc_names.get(t.get('service_type', ''), str(t.get('service_type', '-'))),
                status_names.get(t.get('status', ''), str(t.get('status', '-'))),
                f"{dt:g}"
            ])
            
        ticket_table = Table(rows, colWidths=[8*mm, 35*mm, 60*mm, 20*mm, 20*mm, 18*mm])
        ticket_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.2, 0.3, 0.5)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.98)]),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (5, 0), (5, -1), 'CENTER')
        ]))
        elements.append(ticket_table)
        elements.append(Spacer(1, 8*mm))
        
        # --- KALKULASI RESTITUSI (SKENARIO A) ---
        closed_a = [t for t in tickets if t.get('status') == 'closed' and t.get('scenario') == 'A']
        if closed_a:
            elements.append(Paragraph("<b>3. Kalkulasi Restitusi (Gangguan Jaringan Telkom)</b>", subtitle_style))
            rest_header = ["ID Tiket", "Layanan", "Titik Layanan (IP)", "Down\n(Min)", "SLA %", "Restitusi (Rp)"]
            rest_rows = [rest_header]
            total_rest = 0
            
            for t in closed_a:
                svc = str(t.get('service_type') or '-')
                bw = safe_float(t.get('bandwidth'), 10)
                downtime = safe_float(t.get('total_downtime_minutes'), 0)
                
                contract_setting = await db.settings.find_one({"key": f"contract_{svc}"}, {"_id": 0})
                contract_val = safe_float(contract_setting.get('value') if contract_setting else 0)
                
                result = calculate_restitution(svc, downtime, bw, contract_val, target_month, target_year)
                rest_amount = result.get('restitution_amount', 0) if isinstance(result, dict) else 0
                uptime_pct = result.get('uptime_percentage', 100) if isinstance(result, dict) else 100
                total_rest += rest_amount
                
                sp_name = str(t.get('service_point_name') or t.get('location') or '-')
                ip = '-'
                if t.get('service_point_id'):
                    sp = await db.service_points.find_one({"id": t.get('service_point_id')}, {"_id": 0})
                    if sp:
                        ip = str(sp.get('ip_address', '-'))
                
                sp_display = f"{sp_name[:30]}\nIP: {ip}"
                safe_id = str(t.get('id') or '-')
                
                rest_rows.append([
                    Paragraph(safe_id, id_style),
                    svc.upper(),
                    Paragraph(sp_display, small_style),
                    f"{downtime:g}",
                    f"{uptime_pct:.2f}%",
                    f"Rp {rest_amount:,.0f}"
                ])
            
            rest_rows.append(["", "", "", "", "TOTAL", f"Rp {total_rest:,.0f}"])
            
            rest_table = Table(rest_rows, colWidths=[32*mm, 15*mm, 55*mm, 15*mm, 18*mm, 30*mm])
            rest_table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 7),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('BACKGROUND', (0, 0), (-1, 0), colors.Color(0.5, 0.2, 0.2)),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BACKGROUND', (4, -1), (-1, -1), colors.Color(0.9, 0.9, 0.9)),
                ('FONTNAME', (4, -1), (-1, -1), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ALIGN', (3, 0), (4, -1), 'CENTER')
            ]))
            elements.append(rest_table)
        else:
            elements.append(Paragraph("<i>Tidak ada tiket dengan skenario A (Gangguan Telkom) pada bulan ini yang berpotensi restitusi.</i>", normal_style))
            
        elements.append(Spacer(1, 15*mm))
        
        raw_time = await get_local_time(now.isoformat())
        safe_time_str = str(raw_time)[:10] if raw_time else str(now.date())
        
        sign_data = [
            [f"Makassar, {safe_time_str}"],
            ["Account Manager"],
            [""], [""], [""],
            ["( Wulan Setya Ningsih )"]
        ]
        sign_table = Table(sign_data, colWidths=[180*mm])
        sign_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT'), ('FONTSIZE', (0, 0), (-1, -1), 9)]))
        elements.append(sign_table)
        
        doc.build(elements)

        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        filename = f"Laporan_Bulanan_{period_label}.pdf"
        
        from fastapi.responses import Response

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"', 
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"FATAL ERROR saat membuat PDF Bulanan:\n{error_trace}")
        raise HTTPException(status_code=500, detail=f"Gagal menyusun PDF Bulanan di server. Detail: {str(e)}")


# ============ ADMIN TOOLS (ONE-TIME FIX) ============

@api_router.post("/admin/fix-old-tickets")
async def fix_old_tickets(user: dict = Depends(get_current_user)):
    if user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Hanya Admin yang bisa jalankan pembersihan ini!")

    tickets = await db.tickets.find({"status": "closed"}).to_list(None)
    updated_count = 0

    for t in tickets:
        updates = {}
        
        # 1. Perbaiki waktu tutup (closed_at) supaya pakai completion_time dari EOS (bukan jam AM verifikasi)
        eos_completion_time = t.get('completion_time')
        if eos_completion_time and t.get('closed_at') != eos_completion_time:
            updates['closed_at'] = eos_completion_time
        
        # 2. FILTER AMAN: Hanya proses downtime jika Skenario B, atau nilainya masih 0 / None
        current_downtime = t.get('total_downtime_minutes')
        scenario = t.get('scenario')
        
        needs_downtime_fix = False
        if scenario == 'B' or not current_downtime or current_downtime == 0:
            needs_downtime_fix = True
            
        created_at = t.get('created_at')
        end_time = eos_completion_time or t.get('closed_at')
        
        if needs_downtime_fix and created_at and end_time:
            try:
                c_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                e_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                
                real_downtime = int(max(0, (e_dt - c_dt).total_seconds() / 60))
                
                if current_downtime != real_downtime:
                    updates['total_downtime_minutes'] = real_downtime
                    if t.get('logbook', {}).get('phase5'):
                        updates['logbook.phase5.total_downtime_minutes'] = real_downtime
            except Exception as e:
                logger.error(f"Gagal hitung tiket {t.get('id')}: {e}")
                pass
        
        # Eksekusi update ke database jika ada perubahan
        if updates:
            await db.tickets.update_one({"id": t['id']}, {"$set": updates})
            updated_count += 1

    return {
        "message": "Pembersihan Data Selesai! Data manual Skenario A tetap utuh.", 
        "tiket_diperbaiki": updated_count
    }

# ============ ROOT ============

@api_router.get("/")
async def root():
    return {"message": "Sistem Tiketing & SLA Control Telkom Makassar API"}

@api_router.get("/admin/who-is-online")
async def get_online_users(user: dict = Depends(get_current_user)):
    # BUKA IZIN UNTUK ADMIN DAN AM DI SINI
    if user['role'] not in ['admin', 'am']:
        raise HTTPException(status_code=403, detail="Cuma Boska Admin dan AM yang bisa intip!")
    
    online_data = []
    for uid, detail in ws_manager.user_details.items():
        sessions = len(ws_manager.active_connections.get(uid, []))
        online_data.append({
            "user_id": uid,
            "name": detail['full_name'],
            "role": detail['role'].upper(),
            "sessions": sessions,
            "last_seen": detail['last_seen']
        })
    
    return {"total_online": len(online_data), "users": online_data}
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    # Index yang sudah ada
    await db.ping_results.create_index([("service_point_id", 1), ("timestamp", -1)])
    
    # --- TAMBAHAN INDEX BARU UNTUK TIKET SUPAYA KENCANG BOSKU ---
    await db.tickets.create_index([("created_at", -1)]) # Supaya sorting tiket tidak lemot
    await db.tickets.create_index([("status", 1)])
    await db.tickets.create_index([("service_type", 1)])
    await db.tickets.create_index([("client_id", 1)])
    await db.tickets.create_index([("assigned_to", 1)])
    
    asyncio.create_task(_ping_scheduler())
    asyncio.create_task(sync_mediamtx_config())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ============ WEBSOCKET ENDPOINT ============
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    user_id = None
    role = None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        role = payload.get('role', '')
        if not user_id:
            await websocket.close(code=4001)
            return
            
        # --- AMANKAN POSISI BARIS INI (HARUS MASUK DI DALAM TRY) ---
        user = await db.users.find_one({"id": user_id})
        # Kalau user tidak ketemu di DB, kasih nama default
        full_name = user.get('full_name', user.get('username', 'Unknown User')) if user else "Unknown User"
        
    except Exception as e:
        logger.error(f"WebSocket Auth Error: {e}") 
        await websocket.close(code=4001)
        return

    # Panggil fungsi connect yang sudah kita update tadi
    await ws_manager.connect(websocket, user_id, role, full_name)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        # Pastikan ada 'role' di sini Boska
        ws_manager.disconnect(websocket, user_id, role)
    except Exception as e:
        logger.error(f"WebSocket Runtime Error: {e}")
        ws_manager.disconnect(websocket, user_id, role)


# --- PENUTUP AGAR BISA JALAN SEMPURNA BOSKA ---
if __name__ == "__main__":
    import uvicorn
    # Saya pastikan jalan di port 5000 sesuai pesanan Boska
    uvicorn.run(app, host="0.0.0.0", port=5000)