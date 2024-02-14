// refer: https://medium.com/@jadomene99/integrating-your-opencv-project-into-a-react-component-using-flask-6bcf909c07f4

"use client"
import { CamProps } from "@/types";
import React, { useRef, } from "react";
import { io, Socket } from 'socket.io-client';
import useState from 'react-usestateref'

const DEV_HOST = "https://www.3cap.xyz"
const PROD_HOST = ""  // TODO: PRODUCT HOST
const HOST = process.env.NODE_ENV === 'development' ? DEV_HOST : PROD_HOST

const WIDTH = 640, HEIGHT = 360;

interface ServerToClientEvents {
  response: (image: string) => void;
}

interface ClientToServerEvents {
  image: () => void;
}

const Cam = ({ containerStyles }: CamProps) => {
  const [stream, setStream] = useState<MediaStream>();
  const [imgSrc, setImgSrc] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null!);
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const [socket, setSocket, socketRef] = useState<Socket<ServerToClientEvents, ClientToServerEvents>>();
  const [recordingStatus, setRecordingStatus, statusRef] = useState(false)


  const connectSocket = () => {
    const crtSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(HOST);
    setSocket(crtSocket)

    // Listen for incoming messages
    crtSocket.on('connect', () => {
      console.log(crtSocket.id)
      startCapture();
    })
    crtSocket.on("disconnect", () => {
      console.log("success disconnect"); // undefined
    });
    crtSocket.on('response', (encoded_image) => {
      // 将接收到的 Base64 字符串转换为图像 URL
      const src = 'data:image/jpeg;base64,' + encoded_image;
      // 创建或更新图像元素以显示图像
      setImgSrc(src)
    });
  }

  const closeSocket = () => {

    socket && socket.disconnect();
  }

  const startVideo = () => {
    connectSocket();
  }

  const startCapture = () => {
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia({
      video: true
    })
      .then((mediaStream: MediaStream) => {
        setStream(mediaStream)

        setRecordingStatus(true);

        videoRef.current && (videoRef.current.srcObject = mediaStream);
        captureScreenshot();

      }).catch((err) => {
        console.log(err)
      });

  }

  const captureScreenshot = () => {

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const crtSocket = socketRef.current;

    // 确保视频元素和 Canvas 元素都已加载
    if (video && canvas) {
      // 在 Canvas 上绘制视频截图
      const ctx = canvas.getContext('2d');
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      if (ctx) {
        loop(ctx, video, canvas, crtSocket);
        startInterval(ctx, video, canvas, crtSocket);
      }
    }

  };

  const loop = (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, canvas: HTMLCanvasElement, crtSocket: Socket | undefined) => {
    if (!statusRef.current) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      crtSocket && (crtSocket.emit('image', blob, socketRef.current && socketRef.current.id));
    }, 'image/jpeg');

    // requestAnimationFrame(() => {
    //   if (statusRef.current) {
    //     console.log("----in requestAnimationFrame----")
    //     loop(ctx, video, canvas, crtSocket)
    //   }
    // }); // 继续下一帧的截图

  }

  const startInterval = (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, canvas: HTMLCanvasElement, crtSocket: Socket | undefined) => {
    let timeInterval = setInterval(() => {
      if (statusRef.current) {
        loop(ctx, video, canvas, crtSocket)
      } else {
        clearTimeout(timeInterval)
      }
    }, 100)
  }

  const stopVideo = () => {
    setRecordingStatus(false);

    const tracks = stream && stream.getTracks();

    tracks && (tracks.forEach((track) => {
      track.stop();
    }));

    videoRef.current && (videoRef.current.srcObject = null);

    closeSocket();
  }

  return (
    <div className={containerStyles}>
      <video ref={videoRef} autoPlay playsInline muted width={WIDTH} height={HEIGHT} />
      {imgSrc && recordingStatus ? <img src={imgSrc} alt="" className="mt-4" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px`, }} /> : null}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

      <button className="custom-btn disabled:opacity-25" onClick={startVideo} disabled={recordingStatus}>Start</button>
      <button className="custom-btn disabled:opacity-25" onClick={stopVideo} disabled={!recordingStatus}>Stop</button>
    </div>
  );
};
export default Cam;