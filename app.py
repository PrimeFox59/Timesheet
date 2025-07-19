import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials
import bcrypt

# --- Page Configuration ---
st.set_page_config(
    page_title="Timesheet METSO",
    page_icon="📝",
    layout="wide"
)

# --- Google Sheet Configuration ---
scope = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

key_dict = st.secrets["gcp_service_account"]
creds = Credentials.from_service_account_info(key_dict, scopes=scope)
SHEET_ID = "1BwwoNx3t3MBrsOB3H9BSxnWbYCwChwgl4t1HrpFYWpA"

@st.cache_resource(ttl=3600) # Cache connection for 1 hour (3600 seconds)
def get_google_sheet_client(sheet_id):
    try:
        client = gspread.authorize(creds)
        sheet_user_obj = client.open_by_key(sheet_id).worksheet("user")
        sheet_presensi_obj = client.open_by_key(sheet_id).worksheet("presensi")
        # --- AUDIT TRAIL CHANGE: Add audit_log worksheet object ---
        sheet_audit_log_obj = client.open_by_key(sheet_id).worksheet("audit_log")
        # --- END AUDIT TRAIL CHANGE ---

        return client, sheet_user_obj.title, sheet_presensi_obj.title, sheet_audit_log_obj.title
    except gspread.exceptions.SpreadsheetNotFound:
        st.error(
            "**Error:** Spreadsheet not found. "
            "Please double-check the `SHEET_ID` in your code. "
            "Also, ensure your service account (email in credential) has Editor access to this Google Sheet."
        )
        st.stop()
    except Exception as e:
        st.error(f"**Google Sheets connection error:** {e}. "
                 "Please check your internet connection or Google API status."
                 "If it's a 503 error, try refreshing the app in a few moments.")
        st.stop()

# --- AUDIT TRAIL CHANGE: Get audit_log_title from the client function ---
client, sheet_user_title, sheet_presensi_title, sheet_audit_log_title = get_google_sheet_client(SHEET_ID)
# --- END AUDIT TRAIL CHANGE ---


@st.cache_data(ttl=600) # Cache data for 10 minutes (600 seconds)
def get_data_from_sheet(spreadsheet_id, worksheet_title):
    try:
        worksheet = client.open_by_key(spreadsheet_id).worksheet(worksheet_title)
        # Fetch all records and ensure 'Password' column is treated as string
        df = pd.DataFrame(worksheet.get_all_records())
        if 'Password' in df.columns:
            df['Password'] = df['Password'].astype(str).str.strip() # Strip whitespace
        return df
    except Exception as e:
        st.error(f"Error fetching data from sheet '{worksheet_title}': {e}")
        return pd.DataFrame()


# --- Helper Functions ---
def check_login(user_id, password):
    df_users = get_data_from_sheet(SHEET_ID, sheet_user_title) # Get user data

    user_row = df_users[df_users['Id'].astype(str) == str(user_id)]

    if user_row.empty:
        return None

    # Ensure password from input is bytes
    password_bytes = password.encode('utf-8')

    # Get stored hash, ensure it's a string first, then encode to bytes
    stored_password_value = str(user_row.iloc[0]['Password']).strip()
    stored_hash_bytes = stored_password_value.encode('utf-8')

    # Check if the stored value appears to be a bcrypt hash
    # Bcrypt hashes start with '$2a$', '$2b$', or '$2y$'
    if stored_hash_bytes.startswith(b'$2a$') or stored_hash_bytes.startswith(b'$2b$') or stored_hash_bytes.startswith(b'$2y$'):
        try:
            if bcrypt.checkpw(password_bytes, stored_hash_bytes):
                return user_row.iloc[0]
            else:
                return None # Password mismatch
        except ValueError:
            # Catch error if stored_hash_bytes is malformed bcrypt hash
            st.warning("Invalid hash format detected for existing password. Please contact support.")
            return None
    else:
        # Fallback for old plain text passwords (REMOVE THIS AFTER ALL PASSWORDS ARE HASHED)
        # This fallback allows users with plain text passwords to still log in.
        # Once all users have updated their passwords, you should remove this 'else' block
        # for full bcrypt security.
        if password == stored_password_value:
            return user_row.iloc[0]
        else:
            return None


def get_day_name(date_obj):
    return date_obj.strftime("%A")

def get_date_range(start, end):
    return pd.date_range(start=start, end=end).to_list()

# --- Functions for User Settings ---
def update_user_data_in_sheet(user_id, column_name, new_value):
    """Updates a specific column for a user in the 'user' Google Sheet."""
    sheet_user_actual = client.open_by_key(SHEET_ID).worksheet(sheet_user_title)

    # Fetch records directly to ensure we have the most current state for indexing
    df_users = pd.DataFrame(sheet_user_actual.get_all_records())

    try:
        # Find the row index in the DataFrame (0-based)
        df_row_index = df_users[df_users['Id'].astype(str) == str(user_id)].index[0]

        # Get header for column index (1-based for gspread)
        header = sheet_user_actual.row_values(1)
        if column_name not in header:
            st.error(f"Error: Column '{column_name}' not found in 'user' sheet headers. Please add this column to your 'user' Google Sheet.")
            return False

        col_index = header.index(column_name) + 1
        gsheet_row = df_row_index + 2 # Google Sheet rows are 1-based, and +1 for header

        # Hash password if updating the 'Password' column
        if column_name == "Password":
            # Ensure new_value is string, then encode to bytes for hashing
            new_value_bytes = str(new_value).encode('utf-8')
            hashed_password = bcrypt.hashpw(new_value_bytes, bcrypt.gensalt()).decode('utf-8')
            sheet_user_actual.update_cell(gsheet_row, col_index, hashed_password)
        else:
            sheet_user_actual.update_cell(gsheet_row, col_index, new_value)

        # Invalidate the cache for user data after an update
        get_data_from_sheet.clear()
        return True
    except IndexError:
        st.error(f"User with ID {user_id} not found in the 'user' sheet.")
        return False
    except Exception as e:
        st.error(f"Failed to update {column_name}: {e}")
        return False

# --- AUDIT TRAIL CHANGE: New function to log audit events ---
def log_audit_event(user_id, username, action, description, status="Success"):
    """Logs an audit event to the 'audit_log' Google Sheet."""
    try:
        sheet_audit_log_actual = client.open_by_key(SHEET_ID).worksheet(sheet_audit_log_title)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = [timestamp, user_id, username, action, description, status]
        sheet_audit_log_actual.append_row(log_entry)
        # Clear cache for audit log data after an update
        get_data_from_sheet.clear()
    except Exception as e:
        st.error(f"Error logging audit event: {e}")
# --- END AUDIT TRAIL CHANGE ---

# --- Session State for Login ---
if "user" not in st.session_state:
    st.session_state.user = None
if "logged_out_after_password_change" not in st.session_state:
    st.session_state.logged_out_after_password_change = False


# --- App Title ---
st.image("logo login.png", width=250)

# --- Login Section ---
if st.session_state.user is None:
    st.subheader("🔐 Login to Access Timesheet")

    if st.session_state.logged_out_after_password_change:
        st.info("Your password has been changed. Please log in with your new password.")
        st.session_state.logged_out_after_password_change = False

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
    st.session_state.logged_out_after_password_change = False # Ensure this is reset on normal logout
    st.rerun()

# --- Tab Layout ---
# --- AUDIT TRAIL CHANGE: Add a new tab for "Audit Log" ---
tab1, tab2, tab3, tab4 = st.tabs(["📝 Timesheet Form", "📊 Activity Log", "⚙️ User Settings", "🔍 Audit Log"])
# --- END AUDIT TRAIL CHANGE ---

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

    all_shift_opts = ["Day Shift", "Night Shift", "Noon Shift"]

    # Get user's preferred shift from session state, defaulting to 'Day Shift'
    user_preferred_shift = st.session_state.user.get("Preferred Shift", "Day Shift")
    if user_preferred_shift not in all_shift_opts:
        user_preferred_shift = "Day Shift" # Fallback if preferred shift is invalid

    # Reorder shift options to put preferred shift first
    shift_opts_ordered = [user_preferred_shift] + [s for s in all_shift_opts if s != user_preferred_shift]


    all_area_opts = ["GCP", "ER", "ET", "SC", "SM", "SAP"]

    user_preferred_areas_str = st.session_state.user.get("Preferred Areas", "")
    if user_preferred_areas_str:
        preferred_areas_list = [a.strip() for a in user_preferred_areas_str.split(',') if a.strip()]
        area_opts = [area for area in preferred_areas_list if area in all_area_opts]
        for area in all_area_opts:
            if area not in area_opts:
                area_opts.append(area)
    else:
        area_opts = all_area_opts

    initial_data = []
    for date in date_list:
        initial_data.append({
            "Date": date.strftime("%Y-%m-%d"),
            "Day": get_day_name(date),
            "Hours": 0.0,
            "Overtime": 0.0,
            "Area 1": area_opts[0] if area_opts else "",
            "Area 2": "",
            "Area 3": "",
            "Area 4": "",
            "Shift": user_preferred_shift, # Use preferred shift as default
            "Remark": ""
        })

    df_presensi_input = pd.DataFrame(initial_data)

    st.subheader("Enter Timesheet Details")
    edited_df = st.data_editor(
        df_presensi_input,
        column_config={
            "Date": st.column_config.Column("Date", help="Date of timesheet entry", disabled=True),
            "Day": st.column_config.Column("Day", help="Day of the week", disabled=True),
            "Hours": st.column_config.NumberColumn("Working Hours", min_value=0.0, max_value=24.0, step=0.5, format="%.1f", help="Total working hours (0-24 hours)"),
            "Overtime": st.column_config.NumberColumn("Overtime Hours", min_value=0.0, max_value=24.0, step=0.5, format="%.1f", help="Total overtime hours (0-24 hours)"),
            "Area 1": st.column_config.SelectboxColumn("Area 1", options=area_opts, required=True, default=area_opts[0] if area_opts else ""),
            "Area 2": st.column_config.SelectboxColumn("Area 2", options=[""] + area_opts, required=False, default="", help="Additional work area (optional)"),
            "Area 3": st.column_config.SelectboxColumn("Area 3", options=[""] + area_opts, required=False, default="", help="Additional work area (optional)"),
            "Area 4": st.column_config.SelectboxColumn("Area 4", options=[""] + area_opts, required=False, default="", help="Additional work area (optional)"),
            "Shift": st.column_config.SelectboxColumn("Shift", options=shift_opts_ordered, required=True, default=user_preferred_shift),
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
        duplicate_entries_found = []
        validation_errors = []

        # Ambil data presensi terbaru dari sheet untuk pengecekan duplikasi
        # Pastikan cache untuk data presensi bersih sebelum mengambil
        get_data_from_sheet.clear()
        df_existing_presensi = get_data_from_sheet(SHEET_ID, sheet_presensi_title)

        current_user_id = st.session_state.user["Id"]
        current_username = st.session_state.user["Username"] # Get username for audit log

        # Loop pertama untuk validasi dan identifikasi duplikasi
        for index, row in edited_df.iterrows():
            entry_date_str = row["Date"]

            # 1. Basic validation for Hours and Overtime (numeric and range)
            hours = 0.0
            overtime = 0.0
            try:
                hours = float(row["Hours"])
                overtime = float(row["Overtime"])
                if hours < 0 or overtime < 0:
                    validation_errors.append(f"Hours or Overtime cannot be negative on Date: **{entry_date_str}**.")
            except ValueError:
                validation_errors.append(f"Invalid numeric input for Hours or Overtime on Date: **{entry_date_str}**.")

            # 2. Custom validation: Total hours (Working Hours + Overtime) should not exceed 24
            if (hours + overtime) > 24.01: # Add small tolerance for float arithmetic
                validation_errors.append(f"Total hours (Working Hours + Overtime) on Date: **{entry_date_str}** exceeds 24 hours. Please correct.")

            # 3. Ensure Area 1 is not empty
            if not row["Area 1"] or str(row["Area 1"]).strip() == "":
                validation_errors.append(f"**Area 1** cannot be empty on Date: **{entry_date_str}**.")

            # 4. Check for duplication (Id + Date)
            is_duplicate = df_existing_presensi[
                (df_existing_presensi['Id'].astype(str) == str(current_user_id)) &
                (df_existing_presensi['Date'].astype(str) == entry_date_str)
            ].empty is False

            if is_duplicate:
                duplicate_entries_found.append(entry_date_str)
            else:
                # Add to final_data_to_submit only if no validation errors for this specific row
                # (This is implicitly handled by checking validation_errors globally later)
                entry = {
                    "Id": current_user_id,
                    "Username": st.session_state.user["Username"],
                    "Date": entry_date_str,
                    "Day": row["Day"],
                    "Hours": hours, # Use the float value
                    "Overtime": overtime, # Use the float value
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

        # Display all validation errors first
        if validation_errors:
            for error in validation_errors:
                st.error(f"❗ Input Error: {error}")
            st.warning("Please correct the errors and resubmit.")
            # --- AUDIT TRAIL CHANGE: Log submission failure due to validation errors ---
            log_audit_event(current_user_id, current_username, "Timesheet Submission",
                            f"Failed to submit timesheet for dates: {', '.join([row['Date'] for _, row in edited_df.iterrows()])} due to validation errors.",
                            "Failed")
            # --- END AUDIT TRAIL CHANGE ---

        # Display duplicate entry messages if any
        if duplicate_entries_found:
            st.error(f"❌ Submission Failed: Timesheet for the following dates already exists for user {current_user_id}: **{', '.join(duplicate_entries_found)}**. Please edit existing entries via Activity Log if needed.")
            # --- AUDIT TRAIL CHANGE: Log submission failure due to duplicates ---
            log_audit_event(current_user_id, current_username, "Timesheet Submission",
                            f"Failed to submit timesheet for dates: {', '.join(duplicate_entries_found)} due to duplicate entries.",
                            "Failed")
            # --- END AUDIT TRAIL CHANGE ---

        # Only proceed to submit if NO validation errors AND NO duplicate entries AND there's data to submit
        if not validation_errors and not duplicate_entries_found and final_data_to_submit:
            try:
                sheet_presensi_actual = client.open_by_key(SHEET_ID).worksheet(sheet_presensi_title)
                sheet_presensi_actual.append_rows(final_data_to_submit)
                get_data_from_sheet.clear() # Clear cache again after successful write
                st.success("✅ Timesheet successfully submitted!")
                # --- AUDIT TRAIL CHANGE: Log successful timesheet submission ---
                log_audit_event(current_user_id, current_username, "Timesheet Submission",
                                f"Successfully submitted timesheet for dates: {', '.join([entry[2] for entry in final_data_to_submit])}.")
                # --- END AUDIT TRAIL CHANGE ---
                st.rerun() # Refresh app to clear form and messages
            except Exception as e:
                st.error(f"Error submitting timesheet: {e}")
                # --- AUDIT TRAIL CHANGE: Log submission failure due to general error ---
                log_audit_event(current_user_id, current_username, "Timesheet Submission",
                                f"Failed to submit timesheet due to system error: {e}", "Failed")
                # --- END AUDIT TRAIL CHANGE ---
        elif not final_data_to_submit and not validation_errors and not duplicate_entries_found:
            # This condition handles cases where no new entries are generated due to all being duplicates
            # or if the user submits an empty form range (though st.data_editor makes this less likely)
            st.info("💡 No new timesheet entries to submit (all might be duplicates or zero rows).")
            # --- AUDIT TRAIL CHANGE: Log empty submission ---
            log_audit_event(current_user_id, current_username, "Timesheet Submission",
                            "Attempted submission with no new entries (possibly all duplicates or empty range).", "Info")
            # --- END AUDIT TRAIL CHANGE ---


# --- Activity Log Tab (For All Users) ---
with tab2:
    st.header("📊 All Users Activity Log")

    col_log_start, col_log_end = st.columns(2)

    with col_log_start:
        log_start_date = st.date_input("Log Start Date", datetime.today() - timedelta(days=7), key="all_log_start_date")

    with col_log_end:
        log_end_date = st.date_input("Log End Date", datetime.today(), key="all_log_end_date")

    df_log_all = get_data_from_sheet(SHEET_ID, sheet_presensi_title)

    if 'Date' in df_log_all.columns:
        df_log_all['Date'] = pd.to_datetime(df_log_all['Date'], errors='coerce')
        df_filtered_all_log = df_log_all[(df_log_all['Date'] >= pd.to_datetime(log_start_date)) &
                                         (df_log_all['Date'] <= pd.to_datetime(log_end_date))]
    else:
        st.warning("Column 'Date' not found in 'presensi' sheet for filtering. Displaying all available log data.")
        df_filtered_all_log = df_log_all.copy()

    st.subheader("Filter Activity Log")
    col_filter_user, col_filter_shift, col_filter_area = st.columns(3)

    with col_filter_user:
        all_usernames = ["All"] + sorted(df_filtered_all_log['Username'].unique().tolist())
        selected_username = st.selectbox("Filter by User", all_usernames)

    with col_filter_shift:
        all_shifts = ["All"] + sorted(df_filtered_all_log['Shift'].unique().tolist())
        selected_shift = st.selectbox("Filter by Shift", all_shifts)

    with col_filter_area:
        all_areas_in_log = []
        for col_name in ["Area 1", "Area 2", "Area 3", "Area 4"]:
            if col_name in df_filtered_all_log.columns:
                all_areas_in_log.extend(df_filtered_all_log[col_name].dropna().unique().tolist())
        all_areas_in_log = ["All"] + sorted(list(set(all_areas_in_log)))
        selected_area = st.selectbox("Filter by Area", all_areas_in_log)

    if selected_username != "All":
        df_filtered_all_log = df_filtered_all_log[df_filtered_all_log['Username'] == selected_username]

    if selected_shift != "All":
        df_filtered_all_log = df_filtered_all_log[df_filtered_all_log['Shift'] == selected_shift]

    if selected_area != "All":
        df_filtered_all_log = df_filtered_all_log[
            (df_filtered_all_log['Area 1'] == selected_area) |
            (df_filtered_all_log['Area 2'] == selected_area) |
            (df_filtered_all_log['Area 3'] == selected_area) |
            (df_filtered_all_log['Area 4'] == selected_area)
        ]

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


# --- User Settings Tab
with tab3:
    st.header("⚙️ User Settings")
    st.markdown("Here you can manage your account preferences.")

    current_user_id = st.session_state.user["Id"]
    current_username = st.session_state.user["Username"]

    st.subheader("Change Password")
    with st.form("change_password_form", clear_on_submit=True):
        old_password = st.text_input("Current Password", type="password")
        new_password = st.text_input("New Password", type="password", key="new_pass")
        confirm_new_password = st.text_input("Confirm New Password", type="password", key="confirm_new_pass")
        submit_password_change = st.form_submit_button("Update Password")

        if submit_password_change:
            df_users_latest = get_data_from_sheet(SHEET_ID, sheet_user_title)
            user_row_latest = df_users_latest[df_users_latest['Id'].astype(str) == str(current_user_id)]

            if user_row_latest.empty:
                st.error("User not found for password change. Please try logging in again.")
                # --- AUDIT TRAIL CHANGE: Log password change failure ---
                log_audit_event(current_user_id, current_username, "Password Change", "Failed: User not found.")
                # --- END AUDIT TRAIL CHANGE ---
            else:
                # Ensure stored_password_value is string and strip whitespace
                stored_password_value = str(user_row_latest.iloc[0]['Password']).strip()
                stored_hash_bytes = stored_password_value.encode('utf-8')

                # Check if old_password matches the current stored password
                password_match = False
                if stored_hash_bytes.startswith(b'$2a$') or stored_hash_bytes.startswith(b'$2b$') or stored_hash_bytes.startswith(b'$2y$'):
                    # It's a bcrypt hash
                    try:
                        password_match = bcrypt.checkpw(old_password.encode('utf-8'), stored_hash_bytes)
                    except ValueError:
                        st.error("Error verifying current password. It might be corrupted.")
                        password_match = False # Treat as non-match
                        # --- AUDIT TRAIL CHANGE: Log password change failure ---
                        log_audit_event(current_user_id, current_username, "Password Change", "Failed: Error verifying current password due to corrupted hash.")
                        # --- END AUDIT TRAIL CHANGE ---
                else:
                    # It's a plain text password (TEMPORARY FALLBACK)
                    password_match = (old_password == stored_password_value)

                if not password_match:
                    st.error("❌ Current password incorrect.")
                    # --- AUDIT TRAIL CHANGE: Log password change failure ---
                    log_audit_event(current_user_id, current_username, "Password Change", "Failed: Incorrect current password.")
                    # --- END AUDIT TRAIL CHANGE ---
                elif new_password != confirm_new_password:
                    st.error("❌ New passwords do not match.")
                    # --- AUDIT TRAIL CHANGE: Log password change failure ---
                    log_audit_event(current_user_id, current_username, "Password Change", "Failed: New passwords do not match.")
                    # --- END AUDIT TRAIL CHANGE ---
                elif not new_password:
                    st.warning("⚠️ New password cannot be empty.")
                    # --- AUDIT TRAIL CHANGE: Log password change failure ---
                    log_audit_event(current_user_id, current_username, "Password Change", "Failed: New password cannot be empty.")
                    # --- END AUDIT TRAIL CHANGE ---
                else:
                    if update_user_data_in_sheet(current_user_id, "Password", new_password):
                        st.session_state.user = None
                        st.session_state.logged_out_after_password_change = True
                        st.success("✅ Password updated successfully! Please re-login with your new password.")
                        # --- AUDIT TRAIL CHANGE: Log successful password change ---
                        log_audit_event(current_user_id, current_username, "Password Change", "Successfully updated password.")
                        # --- END AUDIT TRAIL CHANGE ---
                        st.rerun()
                    else:
                        st.error("Something went wrong during password update. Please try again.")
                        # --- AUDIT TRAIL CHANGE: Log password change failure ---
                        log_audit_event(current_user_id, current_username, "Password Change", "Failed: General update error.")
                        # --- END AUDIT TRAIL CHANGE ---

    st.subheader("Change Username")
    with st.form("change_username_form", clear_on_submit=True):
        new_username = st.text_input("New Username", value=current_username)
        submit_username_change = st.form_submit_button("Update Username")

        if submit_username_change:
            if new_username and new_username != current_username:
                if update_user_data_in_sheet(current_user_id, "Username", new_username):
                    st.session_state.user["Username"] = new_username
                    st.success(f"✅ Username updated to '{new_username}' successfully!")
                    # --- AUDIT TRAIL CHANGE: Log successful username change ---
                    log_audit_event(current_user_id, current_username, "Username Change", f"Successfully updated username to '{new_username}'.")
                    # --- END AUDIT TRAIL CHANGE ---
                    st.rerun()
                else:
                    st.error("Something went wrong during username update. Please try again.")
                    # --- AUDIT TRAIL CHANGE: Log username change failure ---
                    log_audit_event(current_user_id, current_username, "Username Change", "Failed: General update error.")
                    # --- END AUDIT TRAIL CHANGE ---
            elif new_username == current_username:
                st.info("💡 Username is already the same. No change needed.")
                # --- AUDIT TRAIL CHANGE: Log username change info ---
                log_audit_event(current_user_id, current_username, "Username Change", "No change needed, username is already the same.", "Info")
                # --- END AUDIT TRAIL CHANGE ---
            else:
                st.warning("⚠️ Username cannot be empty.")
                # --- AUDIT TRAIL CHANGE: Log username change failure ---
                log_audit_event(current_user_id, current_username, "Username Change", "Failed: Username cannot be empty.")
                # --- END AUDIT TRAIL CHANGE ---

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
                # --- AUDIT TRAIL CHANGE: Log successful priority areas update ---
                log_audit_event(current_user_id, current_username, "Update User Preference", f"Successfully updated preferred areas to: {new_preferred_areas_str}.")
                # --- END AUDIT TRAIL CHANGE ---
                st.rerun()
            else:
                st.error("Something went wrong during saving priority areas. Please try again.")
                # --- AUDIT TRAIL CHANGE: Log priority areas update failure ---
                log_audit_event(current_user_id, current_username, "Update User Preference", f"Failed to update preferred areas to: {new_preferred_areas_str}.")
                # --- END AUDIT TRAIL CHANGE ---

    st.subheader("Set Preferred Shift")
    all_shift_opts = ["Day Shift", "Night Shift", "Noon Shift"]
    current_preferred_shift = st.session_state.user.get("Preferred Shift", "Day Shift") # Default to "Day Shift" if not set

    with st.form("set_preferred_shift_form", clear_on_submit=False):
        selected_shift = st.selectbox(
            "Select your most frequently used shift:",
            options=all_shift_opts,
            index=all_shift_opts.index(current_preferred_shift) if current_preferred_shift in all_shift_opts else 0,
            help="This will set the default shift in the Timesheet form."
        )
        submit_preferred_shift = st.form_submit_button("Save Preferred Shift")

        if submit_preferred_shift:
            if update_user_data_in_sheet(current_user_id, "Preferred Shift", selected_shift):
                st.session_state.user["Preferred Shift"] = selected_shift
                st.success("✅ Preferred Shift saved successfully!")
                # --- AUDIT TRAIL CHANGE: Log successful preferred shift update ---
                log_audit_event(current_user_id, current_username, "Update User Preference", f"Successfully updated preferred shift to: {selected_shift}.")
                # --- END AUDIT TRAIL CHANGE ---
                st.rerun()
            else:
                st.error("Something went wrong during saving preferred shift. Please try again.")
                # --- AUDIT TRAIL CHANGE: Log preferred shift update failure ---
                log_audit_event(current_user_id, current_username, "Update User Preference", f"Failed to update preferred shift to: {selected_shift}.")
                # --- END AUDIT TRAIL CHANGE ---


# --- AUDIT TRAIL CHANGE: New Tab for Audit Log ---
with tab4:
    st.header("🔍 System Audit Log")
    st.markdown("This log records significant actions performed within the application.")

    df_audit_log = get_data_from_sheet(SHEET_ID, sheet_audit_log_title)

    if not df_audit_log.empty:
        # Assuming your audit_log sheet has columns like:
        # Timestamp, User ID, Username, Action, Description, Status
        # If your column names are different, adjust them here.
        expected_audit_cols = ["Timestamp", "User ID", "Username", "Action", "Description", "Status"]
        # Ensure all expected columns exist before displaying
        for col in expected_audit_cols:
            if col not in df_audit_log.columns:
                st.warning(f"Audit log column '{col}' not found. Please ensure your 'audit_log' Google Sheet has the correct headers.")
                break # Exit loop if a column is missing

        # Convert Timestamp to datetime for filtering and sorting
        if 'Timestamp' in df_audit_log.columns:
            df_audit_log['Timestamp'] = pd.to_datetime(df_audit_log['Timestamp'], errors='coerce')
            df_audit_log.dropna(subset=['Timestamp'], inplace=True) # Drop rows with invalid timestamps

        # Filters for Audit Log
        st.subheader("Filter Audit Log")
        col_audit_start, col_audit_end = st.columns(2)
        with col_audit_start:
            audit_start_date = st.date_input("Audit Log Start Date", datetime.today() - timedelta(days=30), key="audit_log_start_date")
        with col_audit_end:
            audit_end_date = st.date_input("Audit Log End Date", datetime.today(), key="audit_log_end_date")

        df_filtered_audit_log = df_audit_log[
            (df_audit_log['Timestamp'].dt.date >= audit_start_date) &
            (df_audit_log['Timestamp'].dt.date <= audit_end_date)
        ].copy() # Use .copy() to avoid SettingWithCopyWarning

        col_audit_user, col_audit_action, col_audit_status = st.columns(3)
        with col_audit_user:
            all_audit_users = ["All"] + sorted(df_filtered_audit_log['Username'].unique().tolist())
            selected_audit_user = st.selectbox("Filter by User", all_audit_users, key="selected_audit_user")
        with col_audit_action:
            all_audit_actions = ["All"] + sorted(df_filtered_audit_log['Action'].unique().tolist())
            selected_audit_action = st.selectbox("Filter by Action", all_audit_actions, key="selected_audit_action")
        with col_audit_status:
            all_audit_statuses = ["All"] + sorted(df_filtered_audit_log['Status'].unique().tolist())
            selected_audit_status = st.selectbox("Filter by Status", all_audit_statuses, key="selected_audit_status")

        if selected_audit_user != "All":
            df_filtered_audit_log = df_filtered_audit_log[df_filtered_audit_log['Username'] == selected_audit_user]
        if selected_audit_action != "All":
            df_filtered_audit_log = df_filtered_audit_log[df_filtered_audit_log['Action'] == selected_audit_action]
        if selected_audit_status != "All":
            df_filtered_audit_log = df_filtered_audit_log[df_filtered_audit_log['Status'] == selected_audit_status]

        st.dataframe(
            df_filtered_audit_log[expected_audit_cols]
            .sort_values(by="Timestamp", ascending=False, na_position='last')
            .reset_index(drop=True),
            hide_index=True,
            use_container_width=True
        )
    else:
        st.info("No audit log entries found.")
# --- END AUDIT TRAIL CHANGE ---


# --- Developer Credits ---
st.markdown("---")
st.markdown(
    "<p align='center'>This application was developed by <b>Galih Primananda</b> and <b>Iqlima Nur Hayati</b>, 2025.</p>",
    unsafe_allow_html=True
)
