const elements = [
    'M1_ANDROIDE', 'M2_ANDROIDE', 'M1_BIM', 'M2_BIM', 'M1_DAC', 'M2_DAC', 'M1_IMA', 'M2_IMA', 'M1_IQ', 'M2_IQ',
    'M1_DIGITAL', 'M1_RES', 'M1_RES_ALT', 'M2_DIGITAL', 'M2_RES', 'M2_RES-DEV', 'M2_RES-SEC', 'M1_SAR', 'M2_SAR',
    'M1_SESI', 'M2_SESI', 'M1_CCA ', 'M1_MSI', 'M2_CCA ', 'M2_MSI', 'M1_STL', 'M2_STL', 'M2_STL-INSTA'
];

const { DOMParser } = require('xmldom'); // Import DOMParser from xmldom
const AWS = require('aws-sdk'); // AWS SDK for S3
const s3 = new AWS.S3();

// Process a single calendar
const trigger = async (element) => {
    return createCalendar(element);
};

async function createCalendar(calendar) {
    const xmlData = await getResponse(calendar);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");

    const namespace = "urn:ietf:params:xml:ns:caldav";
    const calendarDataBlocks = xmlDoc.getElementsByTagNameNS(namespace, "calendar-data");

    if (!calendarDataBlocks || calendarDataBlocks.length === 0) {
        console.log("No calendar-data blocks found in the XML response for:", calendar);
        return "BEGIN:VCALENDAR\nCALSCALE:GREGORIAN\nVERSION:2.0\nEND:VCALENDAR";
    }

    let combinedIcs = "BEGIN:VCALENDAR\nCALSCALE:GREGORIAN\nVERSION:2.0\n";

    for (const block of Array.from(calendarDataBlocks)) {
        const icsContent = block.textContent.trim();
        const events = icsContent
            .split('\n')
            .filter(line => !line.startsWith("BEGIN:VCALENDAR") && !line.startsWith("END:VCALENDAR"))
            .join('\n');
        combinedIcs += events + "\n";
    }

    combinedIcs += "END:VCALENDAR";
    return combinedIcs;
}

function separate(title) {
    const pre = title.split('_')[0] + '_';
    const next = title.slice(3);
    let end = title;
    if (next === 'DIGITAL') end = pre + 'RES-EIT-Digital';
    if (next === 'RES_ALT') end = pre + 'RES-ITESCIA';
    if (next === 'RES-SEC') end = pre + 'RES-ITESCIA';
    if (next === 'RES-DEV') end = pre + 'RES-INSTA';
    if (next === 'MSI') end = pre + 'SFPN-AFTI';
    if (next === 'CCA ') end = pre + 'SFPN';
    return {
        end: end,
        fil: end.split('_')[1].split('-')[0],
    };
}

async function getResponse(calendar) {
    const { fil, end } = separate(calendar);
    const url = `https://cal.ufr-info-p6.jussieu.fr/caldav.php/${fil}/${end}/`;
    const payload = `<?xml version="1.0" encoding="UTF-8"?>
        <L:calendar-query xmlns:L="urn:ietf:params:xml:ns:caldav">
            <D:prop xmlns:D="DAV:">
                <D:getcontenttype/>
                <D:getetag/>
                <L:calendar-data/>
            </D:prop>
            <L:filter>
                <L:comp-filter name="VCALENDAR">
                    <L:comp-filter name="VEVENT">
                        <L:time-range start="20250102T000000Z" end="20250725T000000Z"/>
                    </L:comp-filter>
                </L:comp-filter>
            </L:filter>
        </L:calendar-query>`;

    const response = await fetch(url, {
        method: 'REPORT',
        body: payload,
        headers: {
            Authorization: 'Basic ' + Buffer.from('student.master:guest').toString('base64'),
            'Content-Type': 'application/xml',
        },
    });

    return await response.text();
}

// Lambda handler for processing all elements
exports.handler = async () => {
    const bucketName = 'caldavsu';
    const errors = [];
    const success = [];

    for (const element of elements) {
        const fileName = `calendars/${element}.ics`;
        try {
            console.log("Processing:", element);
            const fileContent = await trigger(element);

            const params = {
                Bucket: bucketName,
                Key: fileName,
                Body: fileContent,
                ContentType: 'text/calendar',
            };

            const result = await s3.upload(params).promise();
            console.log("Uploaded successfully:", result.Location);
            success.push({ element, location: result.Location });
        } catch (error) {
            console.error("Error processing:", element, error);
            errors.push({ element, error: error.message });
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ success, errors }),
    };
};
