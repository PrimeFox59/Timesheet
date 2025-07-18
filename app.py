import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials # Menggunakan library yang lebih modern

# --- Konfigurasi Halaman ---
st.set_page_config(
    page_title="Timesheet METSO",
    page_icon="📝",
    layout="wide"
)

# --- Konfigurasi Google Sheet ---
SHEET_ID = "1BwwoNx3t3MBrsOB3H9BSxnWbYCwGChwgl4t1HrpFYWpA" # <-- PASTIKAN ID SHEET INI BENAR!

# Menginisialisasi koneksi ke Google Sheets
try:
    # Mengambil kredensial dari Streamlit secrets
    # st.secrets sudah mengurai TOML ke dictionary, jadi tidak perlu json.loads()
    creds_dict = st.secrets["gcp_service_account"] 
    
    creds = Credentials.from_service_account_info(creds_dict, scopes=[
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ])
    client = gspread.authorize(creds)
    
    # Membuka worksheet yang dibutuhkan
    sheet_user = client.open_by_key(SHEET_ID).worksheet("user")
    sheet_presensi = client.open_by_key(SHEET_ID).worksheet("presensi")

except KeyError:
    st.error(
        "**Error Konfigurasi:** Kredensial akun layanan Google tidak ditemukan di Streamlit secrets. "
        "Pastikan `gcp_service_account` dikonfigurasi dengan benar di secrets aplikasi Anda."
    )
    st.stop()
except gspread.exceptions.SpreadsheetNotFound:
    st.error(
        "**Error Spreadsheet:** Spreadsheet tidak ditemukan. "
        "Mohon periksa kembali `SHEET_ID` di kode Anda. "
        "Juga, pastikan akun layanan Anda (email di `client_email` secrets) memiliki akses Editor ke Google Sheet ini."
    )
    st.stop()
except Exception as e:
    st.error(f"**Error Koneksi Google Sheets:** {e}. "
             "Mohon periksa koneksi internet Anda atau status Google API. "
             "Jika ini error 503, coba refresh aplikasi dalam beberapa saat.")
    st.stop()

# --- Fungsi Pembantu ---
@st.cache_data(ttl="1h") # Cache data pengguna untuk performa
def get_user_data():
    """Mengambil semua record dari sheet 'user'."""
    return pd.DataFrame(sheet_user.get_all_records())

@st.cache_data(ttl="1h") # Cache data presensi
def get_presensi_data():
    """Mengambil semua record dari sheet 'presensi'."""
    return pd.DataFrame(sheet_presensi.get_all_records())

def check_login(user_id, password):
    df = get_user_data()
    user = df[(df['Id'].astype(str) == str(user_id)) & (df['Password'] == password)]
    return user.iloc[0] if not user.empty else None

def get_day_name(date_obj):
    return date_obj.strftime("%A")

def get_date_range(start, end):
    return pd.date_range(start=start, end=end).to_list()

def update_user_data_in_sheet(user_id, column_name, new_value):
    """Memperbarui kolom spesifik untuk user di Google Sheet 'user'."""
    df_users = get_user_data() # Ambil data terbaru
    try:
        # Cari indeks baris (0-based) di DataFrame
        df_row_index = df_users[df_users['Id'].astype(str) == str(user_id)].index[0]
        
        # gspread menggunakan indexing 1-based untuk baris dan kolom
        # Dapatkan indeks kolom (1-based) dari header
        header = sheet_user.row_values(1) # Ambil baris pertama (headers)
        if column_name not in header:
            st.error(f"Error: Kolom '{column_name}' tidak ditemukan di header sheet 'user'.")
            return False

        col_index = header.index(column_name) + 1 # +1 untuk indexing 1-based
        gsheet_row = df_row_index + 2 # +1 untuk indexing 1-based, +1 karena header di baris 1

        sheet_user.update_cell(gsheet_row, col_index, new_value)
        # Hapus cache data user agar data terbaru diambil saat fungsi get_user_data dipanggil lagi
        get_user_data.clear() 
        return True
    except IndexError:
        st.error(f"Pengguna dengan ID {user_id} tidak ditemukan di sheet 'user'.")
        return False
    except Exception as e:
        st.error(f"Gagal memperbarui {column_name}: {e}")
        return False

# --- Session State untuk Login ---
if "user" not in st.session_state:
    st.session_state.user = None

# --- Judul Aplikasi ---
# st.image("logo login.png", width=250) # Pastikan file gambar ini ada di repositori
st.title("Timesheet METSO") # Menggunakan judul teks jika gambar tidak ada/tidak diperlukan

# --- Bagian Login ---
if st.session_state.user is None:
    st.subheader("🔐 Login untuk Akses Timesheet")
    user_id = st.text_input("User ID")
    password = st.text_input("Password", type="password")
    if st.button("Login"):
        user = check_login(user_id, password)
        if user is not None:
            st.session_state.user = user
            st.success("Login berhasil!")
            st.rerun()
        else:
            st.error("❌ User ID atau Password salah")
    st.stop() # Hentikan eksekusi jika belum login

# --- Area Info Sidebar ---
st.sidebar.title("📍 Info Area")
st.sidebar.write("👤 Login sebagai:", st.session_state.user["Username"])
st.sidebar.write("💼 Peran:", st.session_state.user["Role"])
st.sidebar.write("🎓 Grade:", st.session_state.user["Grade"])

st.sidebar.markdown("---")

st.sidebar.markdown("""
**Kode Area:**
- **GCP** / **SAP**: Acid Plant
- **ER**: Electro Refinery
- **ET**: ETP Effluent Treatment Plant
- **SC**: Slag Concentrate
- **SM**: Smelter
""")

if st.sidebar.button("Logout"):
    st.session_state.user = None
    st.rerun()

# --- Tata Letak Tab ---
tab1, tab2, tab3 = st.tabs(["📝 Form Timesheet", "📊 Log Aktivitas", "⚙️ Pengaturan Pengguna"])

# --- Tab Timesheet ---
with tab1:
    st.header("📝 Form Timesheet Online")
    today = datetime.today()
    
    col_start_date, col_end_date = st.columns(2)
    
    with col_start_date:
        start_date = st.date_input("Tanggal Mulai", today - timedelta(days=6))
    
    with col_end_date:
        end_date = st.date_input("Tanggal Selesai", today)

    date_list = get_date_range(start_date, end_date)
    st.markdown(f"**Rentang Tanggal:** {start_date.strftime('%d-%b-%Y')} ➜ {end_date.strftime('%d-%b-%Y')}")

    shift_opts = ["Day Shift", "Night Shift", "Noon Shift"]
    
    # Definisikan semua opsi area yang mungkin
    all_area_opts = ["GCP", "ER", "ET", "SC", "SM", "SAP"]

    # Dapatkan urutan area pilihan pengguna, jika diatur. Jika tidak, gunakan default.
    user_preferred_areas_str = st.session_state.user.get("Preferred Areas", "")
    if user_preferred_areas_str:
        # Konversi string "Area1,Area2" menjadi list ["Area1", "Area2"]
        preferred_areas_list = [a.strip() for a in user_preferred_areas_str.split(',') if a.strip()]
        
        # Buat area_opts akhir dengan menempatkan area pilihan di depan, lalu sisanya
        area_opts = [area for area in preferred_areas_list if area in all_area_opts]
        for area in all_area_opts:
            if area not in area_opts:
                area_opts.append(area)
    else:
        area_opts = all_area_opts # Urutan default

    initial_data = []
    for date in date_list:
        initial_data.append({
            "Date": date.strftime("%Y-%m-%d"),
            "Day": get_day_name(date),
            "Hours": 0.0,
            "Overtime": 0.0,
            "Area 1": area_opts[0] if area_opts else "", # Gunakan area pilihan pertama sebagai default
            "Area 2": "",    
            "Area 3": "",    
            "Area 4": "",    
            "Shift": "Day Shift",
            "Remark": ""
        })

    df_presensi_input = pd.DataFrame(initial_data)

    st.subheader("Masukkan Detail Timesheet")
    edited_df = st.data_editor(
        df_presensi_input,
        column_config={
            "Date": st.column_config.Column("Tanggal", help="Tanggal entri timesheet", disabled=True),
            "Day": st.column_config.Column("Hari", help="Hari dalam seminggu", disabled=True),
            "Hours": st.column_config.NumberColumn("Jam Kerja", min_value=0.0, step=0.5, format="%.1f", help="Total jam kerja"),
            "Overtime": st.column_config.NumberColumn("Jam Lembur", min_value=0.0, step=0.5, format="%.1f", help="Total jam lembur"),
            "Area 1": st.column_config.SelectboxColumn("Area 1", options=area_opts, required=True, default=area_opts[0] if area_opts else ""),
            "Area 2": st.column_config.SelectboxColumn("Area 2", options=[""] + area_opts, required=False, default="", help="Area kerja tambahan (opsional)"),
            "Area 3": st.column_config.SelectboxColumn("Area 3", options=[""] + area_opts, required=False, default="", help="Area kerja tambahan (opsional)"),
            "Area 4": st.column_config.SelectboxColumn("Area 4", options=[""] + area_opts, required=False, default="", help="Area kerja tambahan (opsional)"),
            "Shift": st.column_config.SelectboxColumn("Shift", options=shift_opts, required=True, default="Day Shift"),
            "Remark": st.column_config.TextColumn("Keterangan", help="Contoh: Libur / Perjalanan"),
        },
        column_order=[
            "Date", "Day", "Hours", "Overtime", "Area 1", "Shift", "Remark",
            "Area 2", "Area 3", "Area 4"
        ],
        hide_index=True,
        num_rows="fixed",
        use_container_width=True
    )

    if st.button("📤 Kirim Timesheet"):
        final_data_to_submit = []

        for index, row in edited_df.iterrows():
            entry = {
                "Id": st.session_state.user["Id"],
                "Username": st.session_state.user["Username"],
                "Date": row["Date"],
                "Day": row["Day"],
                "Hours": row["Hours"],
                "Overtime": row["Overtime"],
                "Area 1": row["Area 1"],
                "Area 2": row["Area 2"],
                "Area 3": row["Area 3"],
                "Area 4": row["Area 4"],
                "Shift": row["Shift"],
                "Remark": row["Remark"],
            }
            final_data_to_submit.append([
                entry["Id"], entry["Username"], entry["Date"], entry["Day"],
                entry["Hours"], entry["Overtime"],
                entry["Area 1"], entry["Area 2"], entry["Area 3"], entry["Area 4"],
                entry["Shift"], entry["Remark"]
            ])

        try:
            sheet_presensi.append_rows(final_data_to_submit)
            st.success("✅ Timesheet berhasil dikirim!")
            get_presensi_data.clear() # Hapus cache data presensi
            st.rerun() # Muat ulang untuk menampilkan data terbaru
        except Exception as e:
            st.error(f"Error mengirim timesheet: {e}")

# --- Tab Log Aktivitas (Untuk Semua Pengguna) ---
with tab2:
    st.header("📊 Log Aktivitas Semua Pengguna")

    col_log_start, col_log_end = st.columns(2)
    
    with col_log_start:
        log_start_date = st.date_input("Tanggal Mulai Log", datetime.today() - timedelta(days=7), key="all_log_start_date")
    
    with col_log_end:
        log_end_date = st.date_input("Tanggal Selesai Log", datetime.today(), key="all_log_end_date")

    df_log_all = get_presensi_data() # Ambil data terbaru dari cache

    if not df_log_all.empty and 'Date' in df_log_all.columns:
        df_log_all['Date'] = pd.to_datetime(df_log_all['Date'], errors='coerce')
        df_filtered_all_log = df_log_all[(df_log_all['Date'] >= pd.to_datetime(log_start_date)) &
                                         (df_log_all['Date'] <= pd.to_datetime(log_end_date))]
    else:
        st.warning("Kolom 'Date' tidak ditemukan di sheet 'presensi' atau data kosong. Menampilkan semua data log yang tersedia.")
        df_filtered_all_log = df_log_all.copy()

    columns_to_display_all = [
        "Username",
        "Date",
        "Day", "Hours", "Overtime",
        "Area 1", "Area 2", "Area 3", "Area 4", 
        "Shift", "Remark"
    ]

    existing_columns_all = [col for col in columns_to_display_all if col in df_filtered_all_log.columns]

    st.dataframe(
        df_filtered_all_log[existing_columns_all]
        .sort_values(by="Date", ascending=False, na_position='last')
        .reset_index(drop=True),
        hide_index=True,
        use_container_width=True
    )

# --- Tab Pengaturan Pengguna ---
with tab3:
    st.header("⚙️ Pengaturan Pengguna")
    st.markdown("Di sini Anda dapat mengelola preferensi akun Anda.")

    current_user_id = st.session_state.user["Id"]
    current_username = st.session_state.user["Username"]
    current_password_stored = st.session_state.user["Password"] 

    st.subheader("Ganti Password")
    with st.form("change_password_form", clear_on_submit=True):
        old_password = st.text_input("Password Saat Ini", type="password")
        new_password = st.text_input("Password Baru", type="password", key="new_pass")
        confirm_new_password = st.text_input("Konfirmasi Password Baru", type="password", key="confirm_new_pass")
        submit_password_change = st.form_submit_button("Perbarui Password")

        if submit_password_change:
            if old_password != current_password_stored:
                st.error("❌ Password saat ini salah.")
            elif new_password != confirm_new_password:
                st.error("❌ Password baru tidak cocok.")
            elif new_password == old_password:
                st.warning("⚠️ Password baru tidak boleh sama dengan password lama.")
            elif not new_password:
                st.warning("⚠️ Password baru tidak boleh kosong.")
            else:
                if update_user_data_in_sheet(current_user_id, "Password", new_password):
                    st.session_state.user["Password"] = new_password # Update session state
                    st.success("✅ Password berhasil diperbarui! Mohon login kembali untuk perubahan penuh.")
                    # Setelah mengubah password, sebaiknya pengguna diarahkan untuk logout
                    st.session_state.user = None
                    st.rerun()
                else:
                    st.error("Ada masalah saat memperbarui password. Mohon coba lagi.")

    st.subheader("Ganti Username")
    with st.form("change_username_form", clear_on_submit=True):
        new_username = st.text_input("Username Baru", value=current_username)
        submit_username_change = st.form_submit_button("Perbarui Username")

        if submit_username_change:
            if new_username and new_username != current_username:
                if update_user_data_in_sheet(current_user_id, "Username", new_username):
                    st.session_state.user["Username"] = new_username # Update session state
                    st.success(f"✅ Username berhasil diperbarui menjadi '{new_username}'!")
                    st.rerun()
                else:
                    st.error("Ada masalah saat memperbarui username. Mohon coba lagi.")
            elif new_username == current_username:
                st.info("💡 Username sudah sama. Tidak ada perubahan yang diperlukan.")
            else:
                st.warning("⚠️ Username tidak boleh kosong.")

    st.subheader("Atur Area Prioritas")
    all_area_opts = ["GCP", "ER", "ET", "SC", "SM", "SAP"]

    current_preferred_areas_str = st.session_state.user.get("Preferred Areas", "")
    current_preferred_areas_list = [a.strip() for a in current_preferred_areas_str.split(',') if a.strip()]
    
    # Pastikan area yang sudah ada valid
    current_preferred_areas_list = [area for area in current_preferred_areas_list if area in all_area_opts]

    with st.form("set_priority_areas_form", clear_on_submit=False):
        selected_areas = st.multiselect(
            "Pilih dan urutkan area yang sering Anda gunakan (seret untuk menyusun ulang):",
            options=all_area_opts,
            default=current_preferred_areas_list,
            help="Urutan yang Anda pilih di sini akan menentukan urutan default di dropdown 'Area 1' pada form Timesheet."
        )
        submit_priority_areas = st.form_submit_button("Simpan Area Prioritas")

        if submit_priority_areas:
            new_preferred_areas_str = ", ".join(selected_areas)
            if update_user_data_in_sheet(current_user_id, "Preferred Areas", new_preferred_areas_str):
                st.session_state.user["Preferred Areas"] = new_preferred_areas_str # Update session state
                st.success("✅ Area Prioritas berhasil disimpan!")
                st.rerun()
            else:
                st.error("Ada masalah saat menyimpan area prioritas. Mohon coba lagi.")

# --- Kredit Pengembang ---
st.markdown("---")
st.markdown(
    "<p align='center'>Aplikasi ini dikembangkan oleh <b>Galih Primananda</b> dan <b>Iqlima Nur Hayati</b>, 2025.</p>",
    unsafe_allow_html=True
)
