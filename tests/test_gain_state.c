#include <assert.h>
#include <math.h>
#include <stdio.h>

#include "../src/dsp/gain_state.h"

int main(void) {
    char state[64];
    char too_small[8];
    float restored = 0.0f;
    assert(gain_state_encode(1.375f, state, sizeof(state)) > 0);
    assert(gain_state_decode(state, &restored) == 0);
    assert(fabsf(restored - 1.375f) < 0.00001f);
    assert(gain_state_decode("{\"v\":2}", &restored) < 0);
    assert(gain_state_decode("{\"gain\":nan}", &restored) < 0);
    assert(gain_state_encode(1.0f, too_small, sizeof(too_small)) < 0);
    puts("PASS: gain state round-trips without truncation");
    return 0;
}
