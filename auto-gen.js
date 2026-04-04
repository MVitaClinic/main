const fs = require('fs');
const http = require('https');

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    console.error("Please add it to your GitHub Repository Secrets.");
    process.exit(1);
}

const promptText = `
เขียนบทความภาษาไทยความยาวประมาณ 428 คำ เพื่อโปรโมทการรักษาสิวด้วย "Accure laser" ที่ "เอ็มวีต้าคลินิก" (คลินิกรักษาสิว)
ต้องมี KeyWords ต่อไปนี้ครบถ้วน: คลินิกรักษาสิว, รักษาสิว, เลเซอร์สิว, หลุมสิว, รอยสิว, สิว, รอยดำรอยแดง, Accure laser

ข้อห้ามเด็ดขาด (สำคัญมาก!):
1. ห้ามใช้คำว่า "ยา" หรือคำใดๆ ที่มีสระอาและยอยักษ์ติดกัน เช่น ยาวนาน, พยายาม, รอยาดม, รักษายาก
2. ห้ามใช้คำว่า "ครีม"
3. ห้ามใช้คำว่า "ทีมแพทย์"

เนื้อหาต้องอ่านแล้วเป็นธรรมชาติ น่าสนใจ และจัดรูปแบบเป็น HTML paragraph tags (<p>...</p>) ให้พร้อมใช้งาน (ไม่ต้องใส่ <html> หรือ <head> มาให้ เอาเฉพาะส่วนเนื้อหา <p>, <h2>)
`;

const postData = JSON.stringify({
    contents: [{
        parts: [{ text: promptText }]
    }],
    generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
    }
});

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log("Calling Gemini API...");

const req = http.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => {
        if (res.statusCode !== 200) {
            console.error("API Call Failed:", body);
            process.exit(1);
        }
        
        try {
            const data = JSON.parse(body);
            let generatedHtml = data.candidates[0].content.parts[0].text;
            
            // Clean up backticks if model wrapped in markdown
            generatedHtml = generatedHtml.replace(/```html/g, "").replace(/```/g, "").trim();
            
            console.log("Successfully generated text content.");
            assemblePage(generatedHtml);
            
        } catch (err) {
            console.error("Failed to parse response:", err);
            process.exit(1);
        }
    });
});

req.on("error", (e) => {
    console.error(`Request error: ${e.message}`);
    process.exit(1);
});

req.write(postData);
req.end();

function assemblePage(articleText) {
    // 1. Get random 3 images from bank
    const imageFiles = fs.readdirSync('./images').filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
    
    // Shuffle and pick 3
    const shuffled = imageFiles.sort(() => 0.5 - Math.random());
    const selectedImages = shuffled.slice(0, 3).map(img => `images/${img}`);
    
    // 2. Read template (index.html)
    const indexHtml = fs.readFileSync('./index.html', 'utf8');
    const containerIndex = indexHtml.indexOf('<div class="container">');
    const footerIndex = indexHtml.indexOf('<div class="footer">');

    const topPart = indexHtml.substring(0, containerIndex).replace(/<title>.*<\/title>/, '<title>Accure laser รักษาสิว นวัตกรรมใหม่ที่ดีที่สุด</title>');
    const bottomPart = indexHtml.substring(footerIndex);

    // 3. Construct Body
    const mainBody = `
<div class="container" style="background: rgba(255, 255, 255, 0.9); border-radius: 10px; padding: 40px; margin-top: 20px;">
    <h1 style="color: #A67C00;">นวัตกรรม Accure laser สำหรับ รักษาสิว ที่ เอ็มวีต้าคลินิก (อัพเดทล่าสุด)</h1>
    
    <div style="text-align: center; margin: 30px 0;">
        <img src="${selectedImages[0]}" alt="การดูแลสิวด้วยเทคนิคทันสมัย" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
    </div>

    <div style="text-align: left; color: #333; line-height: 1.6; font-size: 18px;">
        ${articleText.substring(0, Math.floor(articleText.length / 2))}
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <img src="${selectedImages[1]}" alt="เลเซอร์สิว Accure laser" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
    </div>

    <div style="text-align: left; color: #333; line-height: 1.6; font-size: 18px;">
        ${articleText.substring(Math.floor(articleText.length / 2))}
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <img src="${selectedImages[2]}" alt="แพทย์เชี่ยวชาญด้านผิวพรรณ" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
    </div>
    
    <div style="margin-top: 40px; text-align: center;">
        <a href="index.html" class="button" style="text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block;">&lt;&lt; กลับสู่หน้าหลัก</a>
    </div>
</div>
`;

    const fullHtml = topPart + mainBody + bottomPart;
    fs.writeFileSync('./accure-laser-treatment.html', fullHtml);
    console.log("Finished assembling accure-laser-treatment.html with new AI content and images.");
}
