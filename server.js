const express = require("express");
const cors = require("cors");
const { join } = require("path");
const ytdl = require("@distube/ytdl-core");

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());

// get video details
app.post("/api/download", async (req, res) => {
    try {
        const { videoUrl } = req.body;

        if (!ytdl.validateURL(videoUrl)) {
            return res.status(400).json({ error: "Invalid video URL" });
        }

        const info = await ytdl.getInfo(videoUrl);
        const videoTitle = info.videoDetails.title;
        const sanitizedTitle = videoTitle.replace(/[<>:"/\\|?*]/g, "");
        const filePath = join(process.cwd(), "public", `download/${sanitizedTitle}.mp4`);

        const seenQualities = new Set();

        const availableFormats = info.formats
            .filter((format) => format.hasVideo && format.hasAudio && format.contentLength)
            .map((format) => ({
                quality: format.qualityLabel || format.quality,
                mimeType: format.mimeType,
                contentLength: parseInt(format.contentLength),
                itag: format.itag,
            }))
            .sort((a, b) => parseInt(b.quality) - parseInt(a.quality))
            .filter((format) => {
                if (seenQualities.has(format.quality)) return false;
                seenQualities.add(format.quality);
                return true;
            });

        res.json({
            videoDetails: {
                title: videoTitle,
                author: info.videoDetails.author.name,
                thumbnail: info.videoDetails.thumbnails[0].url,
                length: parseInt(info.videoDetails.lengthSeconds),
                availableQualities: availableFormats ?? [],
                filePath: filePath,
            },
        });
    } catch (error) {
        console.error("Error fetching video details:", error);
        res.status(500).json({ error: "Failed to fetch video details" });
    }
});

// stream to download
app.put("/api/download", async (req, res) => {
    try {
        const { videoUrl, title, quality } = req.body;
        const sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, "");

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${sanitizedTitle}.mp4"`);

        const videoStream = ytdl(videoUrl, {
            quality: quality ?? "highest",
            filter: "videoandaudio",
        });

        videoStream.pipe(res);

        videoStream.on("error", (error) => {
            console.error(error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to download video" });
            } else {
                res.end();
            }
        });
    } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ error: "Failed to download video" });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
