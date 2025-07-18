import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials
import json # Import json to parse credentials from st.secrets

# --- Page Configuration ---
st.set_page_config(
    page_title="Timesheet METSO",
    page_icon="📝",
    layout="wide"
)

# --- Google Sheet Configuration for Streamlit Cloud ---
# Ensure your Google Sheet ID is correctly set
SHEET_ID = "1BwwoNx3t3MBrsOB3H9BSxnWbYCwChwgl4t1HrpFYWpA" # <-- Double-check this ID!

# Load credentials from Streamlit secrets
try:
    # st.secrets["gcp_service_account"] should contain the content of your JSON key file
    # as a dictionary or a JSON string that can be parsed into a dictionary.
    # We will assume it's stored as a JSON string for robustness.
    creds_dict = json.loads(st.secrets["gcp_service_account"])
    creds = Credentials.from_service_account_info(creds_dict, scopes=[
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ])
    client = gspread.authorize(creds)
    sheet_user = client.open_by_key(SHEET_ID).worksheet("user")
    sheet_presensi = client.open_by_key(SHEET_ID).worksheet("presensi")
except KeyError:
    st.error(
        "**Error:** Google service account credentials not found in Streamlit secrets. "
        "Please ensure `gcp_service_account` is correctly configured in your app's secrets."
    )
    st.stop()
except gspread.exceptions.SpreadsheetNotFound:
    st.error(
        "**Error:** Spreadsheet not found. "
        "Please double-check the `SHEET_ID` in your code. "
        "Also, ensure your service account (email in credential.json) has Editor access to this Google Sheet."
    )
    st.stop()
except Exception as e:
    st.error(f"**Google Sheets connection error:** {e}. "
             "Please check your internet connection or Google API status."
             "If it's a 503 error, try refreshing the app in a few moments.")
    st.stop()


# --- Helper Functions ---
def check_login(user_id, password):
    df = pd.DataFrame(sheet_user.get_all_records())
    user = df[(df['Id'].astype(str) == str(user_id)) & (df['Password'] == password)]
    return user.iloc[0] if not user.empty else None

def get_day_name(date_obj):
    return date_obj.strftime("%A")

def get_date_range(start, end):
    return pd.date_range(start=start, end=end).to_list()

# --- Functions for User Settings ---
def update_user_data_in_sheet(user_id, column_name, new_value):
    """Updates a specific column for a user in the 'user' Google Sheet."""
    df_users = pd.DataFrame(sheet_user.get_all_records())
    try:
        # Find the row index (0-based) in the DataFrame
        df_row_index = df_users[df_users['Id'].astype(str) == str(user_id)].index[0]
        
        # gspread uses 1-based indexing for rows and columns
        # Get the column index (1-based) from the header
        header = sheet_user.row_values(1) # Get first row (headers)
        if column_name not in header:
            st.error(f"Error: Column '{column_name}' not found in 'user' sheet headers.")
            return False

        col_index = header.index(column_name) + 1 # +1 for 1-based indexing
        gsheet_row = df_row_index + 2 # +1 for 1-based index, +1 because headers are row 1

        sheet_user.update_cell(gsheet_row, col_index, new_value)
        return True
    except IndexError:
        st.error(f"User with ID {user_id} not found in the 'user' sheet.")
        return False
    except Exception as e:
        st.error(f"Failed to update {column_name}: {e}")
        return False

# --- Session State for Login ---
if "user" not in st.session_state:
    st.session_state.user = None

# --- App Title ---
st.image("logo login.png", width=250)

# --- Login Section ---
if st.session_state.user is None:
    st.subheader("🔐 Login to Access Timesheet")
    user_id = st.text_input("User ID")
    password = st.text_input("Password", type="password")
    if st.button("Login"):
        user = check_login(user_id, password)
        if user is not None:
            st.session_state.user = user
            st.success("Login successful!")
            st.rerun()
        else:
            st.error("❌ Incorrect User ID or Password")
    st.stop()

# --- Sidebar Info Area ---
st.sidebar.title("📍 Info Area")
st.sidebar.write("👤 Logged in as:", st.session_state.user["Username"])
st.sidebar.write("💼 Role:", st.session_state.user["Role"])
st.sidebar.write("🎓 Grade:", st.session_state.user["Grade"])

st.sidebar.markdown("---")

st.sidebar.markdown("""
**Area Codes:**
- **GCP** / **SAP**: Acid Plant
- **ER**: Electro Refinery
- **ET**: ETP Effluent Treatment Plant
- **SC**: Slag Concentrate
- **SM**: Smelter
""")

if st.sidebar.button("Logout"):
    st.session_state.user = None
    st.rerun()

# --- Tab Layout ---
tab1, tab2, tab3 = st.tabs(["📝 Timesheet Form", "📊 Activity Log", "⚙️ User Settings"]) # Added tab3

# --- Timesheet Tab ---
with tab1:
    st.header("📝 Online Timesheet Form")
    today = datetime.today()
    
    col_start_date, col_end_date = st.columns(2)
    
    with col_start_date:
        start_date = st.date_input("Start Date", today - timedelta(days=6))
    
    with col_end_date:
        end_date = st.date_input("End Date", today)

    date_list = get_date_range(start_date, end_date)
    st.markdown(f"**Date Range:** {start_date.strftime('%d-%b-%Y')} ➜ {end_date.strftime('%d-%b-%Y')}")

    shift_opts = ["Day Shift", "Night Shift", "Noon Shift"]
    
    # Define all possible area options
    all_area_opts = ["GCP", "ER", "ET", "SC", "SM", "SAP"]

    # Get user's preferred area order, if set. Otherwise, use default.
    # Ensure 'Preferred Areas' column exists in your 'user' sheet!
    user_preferred_areas_str = st.session_state.user.get("Preferred Areas", "")
    if user_preferred_areas_str:
        # Convert string "Area1,Area2" to list ["Area1", "Area2"]
        preferred_areas_list = [a.strip() for a in user_preferred_areas_str.split(',') if a.strip()]
        
        # Create final area_opts by putting preferred areas first, then remaining
        # Ensure no duplicates and all are valid from all_area_opts
        area_opts = [area for area in preferred_areas_list if area in all_area_opts]
        for area in all_area_opts:
            if area not in area_opts:
                area_opts.append(area)
    else:
        area_opts = all_area_opts # Default order

    initial_data = []
    for date in date_list:
        initial_data.append({
            "Date": date.strftime("%Y-%m-%d"),
            "Day": get_day_name(date),
            "Hours": 0.0,
            "Overtime": 0.0,
            "Area 1": area_opts[0] if area_opts else "", # Use the first preferred area as default
            "Area 2": "",    
            "Area 3": "",    
            "Area 4": "",    
            "Shift": "Day Shift",
            "Remark": ""
        })

    df_presensi_input = pd.DataFrame(initial_data)

    st.subheader("Enter Timesheet Details")
    edited_df = st.data_editor(
        df_presensi_input,
        column_config={
            "Date": st.column_config.Column("Date", help="Date of timesheet entry", disabled=True),
            "Day": st.column_config.Column("Day", help="Day of the week", disabled=True),
            "Hours": st.column_config.NumberColumn("Working Hours", min_value=0.0, step=0.5, format="%.1f", help="Total working hours"),
            "Overtime": st.column_config.NumberColumn("Overtime Hours", min_value=0.0, step=0.5, format="%.1f", help="Total overtime hours"),
            "Area 1": st.column_config.SelectboxColumn("Area 1", options=area_opts, required=True, default=area_opts[0] if area_opts else ""), # Updated options and default
            "Area 2": st.column_config.SelectboxColumn("Area 2", options=[""] + area_opts, required=False, default="", help="Additional work area (optional)"),
            "Area 3": st.column_config.SelectboxColumn("Area 3", options=[""] + area_opts, required=False, default="", help="Additional work area (optional)"),
            "Area 4": st.column_config.SelectboxColumn("Area 4", options=[""] + area_opts, required=False, default="", help="Additional work area (optional)"),
            "Shift": st.column_config.SelectboxColumn("Shift", options=shift_opts, required=True, default="Day Shift"),
            "Remark": st.column_config.TextColumn("Remarks", help="E.g., Day off / Travel"),
        },
        column_order=[
            "Date", "Day", "Hours", "Overtime", "Area 1", "Shift", "Remark",
            "Area 2", "Area 3", "Area 4"
        ],
        hide_index=True,
        num_rows="fixed",
        use_container_width=True
    )

    if st.button("📤 Submit Timesheet"):
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
            st.success("✅ Timesheet successfully submitted!")
        except Exception as e:
            st.error(f"Error submitting timesheet: {e}")

# --- Activity Log Tab (For All Users) ---
with tab2:
    st.header("📊 All Users Activity Log")

    col_log_start, col_log_end = st.columns(2)
    
    with col_log_start:
        log_start_date = st.date_input("Log Start Date", datetime.today() - timedelta(days=7), key="all_log_start_date")
    
    with col_log_end:
        log_end_date = st.date_input("Log End Date", datetime.today(), key="all_log_end_date")

    df_log_all = pd.DataFrame(sheet_presensi.get_all_records())

    if 'Date' in df_log_all.columns:
        df_log_all['Date'] = pd.to_datetime(df_log_all['Date'], errors='coerce')
        df_filtered_all_log = df_log_all[(df_log_all['Date'] >= pd.to_datetime(log_start_date)) &
                                         (df_log_all['Date'] <= pd.to_datetime(log_end_date))]
    else:
        st.warning("Column 'Date' not found in 'presensi' sheet for filtering. Displaying all available log data.")
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

# --- User Settings Tab ---
with tab3:
    st.header("⚙️ User Settings")
    st.markdown("Here you can manage your account preferences.")

    current_user_id = st.session_state.user["Id"]
    current_username = st.session_state.user["Username"]
    current_password_hashed = st.session_state.user["Password"] # This is the current stored password

    st.subheader("Change Password")
    with st.form("change_password_form", clear_on_submit=True):
        old_password = st.text_input("Current Password", type="password")
        new_password = st.text_input("New Password", type="password", key="new_pass")
        confirm_new_password = st.text_input("Confirm New Password", type="password", key="confirm_new_pass")
        submit_password_change = st.form_submit_button("Update Password")

        if submit_password_change:
            if old_password != current_password_hashed:
                st.error("❌ Current password incorrect.")
            elif new_password != confirm_new_password:
                st.error("❌ New passwords do not match.")
            elif new_password == old_password:
                st.warning("⚠️ New password cannot be the same as the old password.")
            elif not new_password:
                st.warning("⚠️ New password cannot be empty.")
            else:
                if update_user_data_in_sheet(current_user_id, "Password", new_password):
                    st.session_state.user["Password"] = new_password
                    st.success("✅ Password updated successfully! Please re-login for changes to take full effect.")
                else:
                    st.error("Something went wrong during password update. Please try again.")

    st.subheader("Change Username")
    with st.form("change_username_form", clear_on_submit=True):
        new_username = st.text_input("New Username", value=current_username)
        submit_username_change = st.form_submit_button("Update Username")

        if submit_username_change:
            if new_username and new_username != current_username:
                if update_user_data_in_sheet(current_user_id, "Username", new_username):
                    st.session_state.user["Username"] = new_username
                    st.success(f"✅ Username updated to '{new_username}' successfully!")
                    st.rerun()
                else:
                    st.error("Something went wrong during username update. Please try again.")
            elif new_username == current_username:
                st.info("💡 Username is already the same. No change needed.")
            else:
                st.warning("⚠️ Username cannot be empty.")

    st.subheader("Set Priority Areas")
    all_area_opts = ["GCP", "ER", "ET", "SC", "SM", "SAP"]

    current_preferred_areas_str = st.session_state.user.get("Preferred Areas", "")
    current_preferred_areas_list = [a.strip() for a in current_preferred_areas_str.split(',') if a.strip()]
    
    current_preferred_areas_list = [area for area in current_preferred_areas_list if area in all_area_opts]

    with st.form("set_priority_areas_form", clear_on_submit=False):
        selected_areas = st.multiselect(
            "Select and order your frequently used areas (drag to reorder):",
            options=all_area_opts,
            default=current_preferred_areas_list,
            help="The order you select here will determine the default order in the Timesheet form's 'Area 1' dropdown."
        )
        submit_priority_areas = st.form_submit_button("Save Priority Areas")

        if submit_priority_areas:
            new_preferred_areas_str = ", ".join(selected_areas)
            if update_user_data_in_sheet(current_user_id, "Preferred Areas", new_preferred_areas_str):
                st.session_state.user["Preferred Areas"] = new_preferred_areas_str
                st.success("✅ Priority Areas saved successfully!")
                st.rerun()
            else:
                st.error("Something went wrong during saving priority areas. Please try again.")


# --- Developer Credits ---
st.markdown("---")
st.markdown(
    "<p align='center'>This application was developed by <b>Galih Primananda</b> and <b>Iqlima Nur Hayati</b>, 2025.</p>",
    unsafe_allow_html=True
)