package dev.uwen.yuzujukebox;

import android.app.Activity;
import android.view.Window;

import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 系统栏（状态栏/导航栏）图标明暗桥。targetSdk 36 强制 edge-to-edge：状态栏
 * 透明、Web 内容画到其下，图标对比度由 appearanceLightStatusBars 决定。
 * 基座主题是 DayNight（只跟随系统），App 深色 + 系统浅色时深色图标压在深色
 * 内容上不可见——故图标明暗由 Web 主题轴（applyScheme）经此桥驱动。
 */
@CapacitorPlugin(name = "YuzuSystemBars")
public class YuzuSystemBarsPlugin extends Plugin {

    @PluginMethod
    public void setScheme(PluginCall call) {
        Boolean dark = call.getBoolean("dark");
        if (dark == null) {
            call.reject("dark is required");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        activity.runOnUiThread(() -> {
            Window window = activity.getWindow();
            WindowInsetsControllerCompat controller =
                    new WindowInsetsControllerCompat(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
