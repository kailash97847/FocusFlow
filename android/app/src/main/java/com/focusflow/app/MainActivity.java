package com.focusflow.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * FocusFlow main activity — hosts the Capacitor WebView.
 *
 * Creates the notification channel used by the timer's phase-end alerts.
 * (Android 8+ requires channels; creating it here keeps the JS layer dumb.)
 */
public class MainActivity extends BridgeActivity {

    public static final String PHASE_CHANNEL_ID = "focusflow_phases";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createPhaseNotificationChannel();
    }

    private void createPhaseNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                PHASE_CHANNEL_ID,
                "Focus phases",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Alerts when a focus or break phase completes");
            channel.enableVibration(false); // the app plays its own chime
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
