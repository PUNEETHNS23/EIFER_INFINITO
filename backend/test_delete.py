import getpass
import requests

sport_users = {
    "cricket": "cricket_admin",
    "football": "football_admin",
    "volleyball": "volleyball_admin",
}

res = requests.get("http://localhost:8000/api/matches")
if res.status_code == 200:
    matches = res.json()
    print("Matches:", len(matches))
    if len(matches) > 0:
        sport_id = matches[0]["sport_id"]
        username = sport_users.get(sport_id, "general_admin")
        password = getpass.getpass(f"Password for {username}: ")
        login = requests.post("http://localhost:8000/api/auth/token", data={"username": username, "password": password})
        if login.status_code != 200:
            print("Login failed:", login.text)
        else:
            token = login.json()["access_token"]
            m_id = matches[0]["id"]
            d_res = requests.delete(f"http://localhost:8000/api/matches/{m_id}", headers={"Authorization": f"Bearer {token}"})
            print(f"Delete match {m_id} status:", d_res.status_code)
            print("Response:", d_res.text)
            if d_res.status_code == 200:
                print("Deleted successfully!")
