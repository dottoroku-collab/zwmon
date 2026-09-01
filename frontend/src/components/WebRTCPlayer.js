import React, { useEffect, useRef } from 'react';
import { MonitorOff } from 'lucide-react';

const WebRTCPlayer = ({ streamId, token, onError, onPlaying, isGrid }) => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);

  useEffect(() => {
    let active = true;

    const startWebRTC = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        pcRef.current = pc;

        pc.addTransceiver('video', { direction: 'recvonly' });
        // Mute audio by default to avoid autoplay policies
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // This assumes Nginx proxies /webrtc to MediaMTX port 8889
        const response = await fetch(`https://zwmon.com/webrtc/${streamId}/whep`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        });

        if (!response.ok) {
          throw new Error('WebRTC Negotiation Failed');
        }

        const answerSdp = await response.text();
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: answerSdp
        }));

      } catch (err) {
        console.error('WebRTC Error:', err);
        if (active && onError) onError(err);
      }
    };

    startWebRTC();

    return () => {
      active = false;
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [streamId]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`w-full h-full ${isGrid ? 'object-cover' : 'object-contain'} bg-black`}
      onError={(e) => onError && onError(e)}
      onPlaying={() => onPlaying && onPlaying()}
    />
  );
};

export default WebRTCPlayer;
