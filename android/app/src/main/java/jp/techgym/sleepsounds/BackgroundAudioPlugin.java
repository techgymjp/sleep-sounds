package jp.techgym.sleepsounds;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JavaScript（js/app.js）から呼ぶ、バックグラウンド再生の開始・停止。
 * 鳴らしているあいだ PlaybackService（フォアグラウンドサービス）を動かし、
 * 画面を消しても・ほかのアプリに切り替えても WebView の音が止まらないようにする。
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    private boolean askedNotification = false;

    @Override
    public void load() {
        // 通知の「停止」が押されたら JavaScript に知らせる
        PlaybackService.stopListener = () -> notifyListeners("stopRequested", new JSObject());
    }

    @PluginMethod
    public void start(PluginCall call) {
        askNotificationPermissionOnce();
        Intent intent = new Intent(getContext(), PlaybackService.class);
        intent.putExtra(PlaybackService.EXTRA_TITLE, call.getString("title"));
        intent.putExtra(PlaybackService.EXTRA_TEXT, call.getString("text"));
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            // 起動できなくても、アプリを開いているあいだは音が鳴る
            call.reject("could not start playback service", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        PlaybackService.stopListener = null;
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
    }

    // Android 13 以降は、通知を出すのに許可がいる。最初に再生したときに一度だけ聞く
    // （許可されなくても再生は続く。通知が出ないだけ）
    private void askNotificationPermissionOnce() {
        if (askedNotification || Build.VERSION.SDK_INT < 33 || getActivity() == null) return;
        askedNotification = true;
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(getActivity(), new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7301);
        }
    }
}
