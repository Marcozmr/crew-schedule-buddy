package br.app.escalax;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import br.app.escalax.plugins.LatamRosterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LatamRosterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
