package jp.techgym.sleepsounds;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // バックグラウンド再生のプラグイン（このアプリだけのもの）を登録する
        registerPlugin(BackgroundAudioPlugin.class);
        super.onCreate(savedInstanceState);
        // ゲームと違い、画面は消えてよい（FLAG_KEEP_SCREEN_ON は付けない）。
        // 音は PlaybackService が鳴らし続ける
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    // ステータスバーとナビゲーションバーを隠して全画面にする（端からスワイプで一時表示）
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
