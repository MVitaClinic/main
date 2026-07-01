
const fs = require('fs');
const http = require('https');

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    console.error("Please add it to your GitHub Repository Secrets.");
    process.exit(1);
}

const promptText = `
เขียนบทความภาษาไทยขึ้นมาใหม่ให้ไม่เหมือนบทความใดๆแบบสุ่ม ความยาวประมาณ 639 คำ โดยบทความจะเป็นการพูดถึงคำนิยมของลูกค้าที่ตั้งใจเดินทางมาเข้ารับบริการ ที่ "เอ็มวีต้าคลินิก" (คลินิกรักษาสิว)
โดยบทความจะทำการสุ่มเลือก 1 โลเคชั่น จากทำเลต่อไปนี้ อโศก, พร้อมพงษ์, ทองหล่อ, เอกมัย, นานา, ชิดลม, เพลินจิต, สยาม, ประตูน้ำ, บรรทัดทอง, สามย่าน, พระราม 9, รัชดา (รัชดาภิเษก), ห้วยขวาง, ดินแดง
และ ระบุอยู่ในชื่อบทความและเนื้อหาด้วย โดยที่ชื่อบทความจะต้องเป็นไปตามเทรนด์,กระแสหรือเหตุการณ์ในประเทศไทยของวันที่เขียน และ ไม่ซ้ำ, ผนวกกับมุมมองที่แตกต่างไม่ค่อยมีใครพูดถึง รวมทั้งบทความนี้ต้องมี Keywords ต่อไปนี้ปะปนแบบสุ่มอยู่ในบทความ: คลินิกรักษาสิว, รักษาสิว, เลเซอร์สิว, หลุมสิว, รอยสิว, สิว, รอยดำรอยแดง, Accure laser

ข้อห้ามเด็ดขาด (สำคัญมาก!):
1. ห้ามใช้คำว่า "ยา" 
2. ห้ามใช้คำว่า "ครีม"
3. ห้ามใช้คำว่า "ทีมแพทย์"

ชื่อหัวข้อบทความต้องใหม่ล่าสุด ไม่ซ้ำ และ ใช้หลัก Semantic SEO ในการตั้งชื่อ ส่วนเนื้อหาต้องใหม่ ให้มุมมองใหม่ ไม่ซ้ำ อ่านแล้วเป็นธรรมชาติ น่าสนใจ และ จัดรูปแบบเป็น HTML paragraph tags (<p>...</p>) ให้พร้อมใช้งาน (ไม่ต้องใส่ <html> หรือ <head> มาให้ เอาเฉพาะส่วนเนื้อหา <p>, <h2>)
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
    path: `/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${API_KEY}`,
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
    // Extract title from the article
    const headerRegex = /<(h[12])[^>]*>([\s\S]*?)<\/h[12]>/i;
    const match = articleText.match(headerRegex);

    let articleTitle = "";
    let cleanedArticleText = articleText;

    if (match) {
        articleTitle = match[2].replace(/<[^>]+>/g, '').trim();
        cleanedArticleText = articleText.replace(headerRegex, '').trim();
    } else {
        articleTitle = "เอ็มวีต้าคลินิก คลินิกรักษาสิว";
    }

    // 1. Generate filename and title related to the article without date
    const slug = articleTitle
        .toLowerCase()
        .replace(/[^a-z0-9\u0e00-\u0e7f]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || `คลินิกรักษาสิวใกล้ฉัน-${Date.now()}`;
    
    const shortSlug = slug.substring(0, 36).replace(/-$/, '');
    const newFileName = `${slug}.html`;
    const newFileTitle = articleTitle;

    // 2. Get random 3 images from bank
    const imageFiles = fs.readdirSync('./images').filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
    
    // Shuffle and pick 3
    const shuffled = imageFiles.sort(() => 0.5 - Math.random());
    const selectedImages = shuffled.slice(0, 3).map(img => `images/${img}`);
    
    // 3. Read template (index.html)
    let indexHtml = fs.readFileSync('./index.html', 'utf8');
    const containerIndex = indexHtml.indexOf('<div class="container">');
    const footerIndex = indexHtml.indexOf('<div class="footer">');

    const topPart = indexHtml.substring(0, containerIndex).replace(/<title>.*<\/title>/, `<title>${newFileTitle}</title>`);
    const bottomPart = indexHtml.substring(footerIndex);

    // 4. Construct Content Body
    const mainBody = `
<div class="container" style="background: rgba(255, 255, 255, 0.9); border-radius: 10px; padding: 40px; margin-top: 20px;">
    <h1 style="color: #A67C00;">${articleTitle}</h1>
    
    <div style="text-align: center; margin: 30px 0;">
        <img src="${selectedImages[0]}" alt="การดูแลรักษาสิวด้วยเทคนิคทันสมัย" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
    </div>

    <div style="text-align: left; color: #333; line-height: 1.6; font-size: 18px;">
        ${cleanedArticleText.substring(0, Math.floor(cleanedArticleText.length / 2))}
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <img src="${selectedImages[1]}" alt="เลเซอร์สิว Accure laser" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
    </div>

    <div style="text-align: left; color: #333; line-height: 1.6; font-size: 18px;">
        ${cleanedArticleText.substring(Math.floor(cleanedArticleText.length / 2))}
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <img src="${selectedImages[2]}" alt="หมอรักษาสิว" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
    </div>
    
    <div style="margin-top: 40px; text-align: center;">
        <a href="index.html" class="button" style="text-decoration: none; padding: 15px 30px; border-radius: 50px; font-weight: bold; font-size: 18px; display: inline-block;">&lt;&lt; กลับสู่หน้าหลัก</a>
    </div>
</div>
`;

    const fullHtml = topPart + mainBody + bottomPart;
    fs.writeFileSync(`./${newFileName}`, fullHtml);
    console.log(`Successfully saved new article as ${newFileName}`);

    // 5. Append New Link to index.html
    const linkAnchor = '<h2>เพิ่มเติมเกี่ยวกับ เอ็มวีต้าคลินิก</h2>';
    const newLinkHtml = `\n        <p><strong>บทความอัพเดทใหม่:</strong> <a href="${newFileName}" style="color: #A67C00; text-decoration: underline;">${newFileTitle}</a></p>`;
    
    // Inject right after the <h2>...</h2>
    if (indexHtml.includes(linkAnchor)) {
        indexHtml = indexHtml.replace(linkAnchor, linkAnchor + newLinkHtml);
        fs.writeFileSync('./index.html', indexHtml);
        console.log("Successfully appended new article link to index.html");
    } else {
        console.error("Warning: Could not find anchor tag in index.html to insert the link.");
    }
}
