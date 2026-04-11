import requests

login = requests.post("http://localhost:8000/api/auth/token", data={"username": "admin", "password": "password"})
if login.status_code != 200:
    print("Login failed:", login.text)
    login = requests.post("http://localhost:8000/api/auth/token", data={"username": "admin", "password": "admin"})

if login.status_code == 200:
    token = login.json()["access_token"]
    res = requests.get("http://localhost:8000/api/matches")
    if res.status_code == 200:
        matches = res.json()
        print("Matches:", len(matches))
        if len(matches) > 0:
            m_id = matches[0]["id"]
            d_res = requests.delete(f"http://localhost:8000/api/matches/{m_id}", headers={"Authorization": f"Bearer {token}"})
            print(f"Delete match {m_id} status:", d_res.status_code)
            print("Response:", d_res.text)
            if d_res.status_code == 200:
                print("Deleted successfully!")
