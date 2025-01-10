import xml.etree.ElementTree as ET
import requests,re
from requests.auth import HTTPBasicAuth

def create_calendar(year, fil):
    # parsing of the xml file retrieved 
    xml_data = get_response(year,fil)
    namespace = {"C": "urn:ietf:params:xml:ns:caldav"}

    root = ET.fromstring(xml_data)
    calendar_data_blocks = root.findall(".//C:calendar-data", namespace)
    combined_ics = "BEGIN:VCALENDAR\nCALSCALE:GREGORIAN\nVERSION:2.0\n"

    for block in calendar_data_blocks:
        ics_content = block.text.strip()
        events = "\n".join(line for line in ics_content.splitlines() if not line.startswith("BEGIN:VCALENDAR") and not line.startswith("END:VCALENDAR"))
        combined_ics += events + "\n"

    combined_ics += "END:VCALENDAR"

    with open(f"{year}_{fil}.ics", "w", encoding="utf-8") as file:
        file.write(combined_ics)
    print(f"Tous les événements ont été combinés dans {year}_{fil}.ics.")
    

def get_response(year, fil):
    # create request and get response according to a calendar  
    url = f"https://cal.ufr-info-p6.jussieu.fr/caldav.php/{fil}/{year}_{fil}/"
    payload = """<?xml version="1.0" encoding="UTF-8"?><L:calendar-query xmlns:L="urn:ietf:params:xml:ns:caldav"><D:prop xmlns:D="DAV:"><D:getcontenttype/><D:getetag/><L:calendar-data/></D:prop><L:filter><L:comp-filter name="VCALENDAR"><L:comp-filter name="VEVENT"><L:time-range start="20250102T000000Z" end="20250725T000000Z"/></L:comp-filter></L:comp-filter></L:filter></L:calendar-query>"""
    response = requests.request("REPORT", url, data=payload, auth=HTTPBasicAuth("student.master", "guest"))
    return response.text

create_calendar('M2','SAR')