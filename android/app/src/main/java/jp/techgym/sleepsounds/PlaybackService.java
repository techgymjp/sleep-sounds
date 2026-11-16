package jp.techgym.sleepsounds;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * 再生中だけ動かすフォアグラウンドサービス。「再生中」の通知を出し、WakeLock で CPU を止めないようにして、
 * 画面を消しても WebView（Web Audio）の音が鳴り続けるようにする。音そのものは WebView が鳴らす。
 */
public class PlaybackService extends Service {

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String ACTION_STOP = "jp.techgym.sleepsounds.STOP";
    private static final String CHANNEL_ID = "playback";
    private static final int NOTIFICATION_ID = 1;
    // タイマーなしで朝まで鳴らしても足りる長さ。これを過ぎると WakeLock は自動で外れる
    private static final long WAKE_LOCK_MS = 12L * 60 * 60 * 1000;

    /** 通知の「停止」が押されたときに呼ぶ（BackgroundAudioPlugin が設定する） */
    static Runnable stopListener;

    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            if (stopListener != null) stopListener.run();
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        String text = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
        Notification n = buildNotification(
            title != null ? title : getString(R.string.playback_title),
            text != null ? text : getString(R.string.playback_text)
        );
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sleepsounds:playback");
            wakeLock.setReferenceCounted(false);
        }
        wakeLock.acquire(WAKE_LOCK_MS);
        // アプリごと終了されたら、勝手に起動し直さない（音を鳴らす WebView がもうないため）
        return START_NOT_STICKY;
    }

    private Notification buildNotification(String title, String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, getString(R.string.playback_channel), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        }
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        // 通知を押したらアプリを開く
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, piFlags);
        // 「停止」ボタン
        Intent stop = new Intent(this, PlaybackService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, piFlags);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_sleep)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openPi)
            .addAction(0, getString(R.string.playback_stop), stopPi)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 最近使ったアプリの一覧からスワイプで消されたら、通知も消して終わる
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
